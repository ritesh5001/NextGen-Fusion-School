/**
 * Server-only access to the vendor signing keypair.
 *
 * The keypair lives in the single-row `platform_keys` table. On a vendor
 * deployment it is generated lazily the first time a license is issued from the
 * admin panel. Customer deployments never hold the private key — they verify
 * against the public key in `LICENSE_PUBLIC_KEY`.
 */
import { generateKeypair } from "./license-crypto.server";

export async function getOrCreatePlatformKeys(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const { getDb } = await import("@/db/client.server");
  const { platformKeys } = await import("@/db/schema");
  const db = getDb();
  const existing = await db.select().from(platformKeys).limit(1);
  if (existing[0]) {
    return { privateKey: existing[0].privateKey, publicKey: existing[0].publicKey };
  }
  const kp = generateKeypair();
  await db
    .insert(platformKeys)
    .values({ id: 1, privateKey: kp.privateKey, publicKey: kp.publicKey })
    .onConflictDoNothing();
  const row = (await db.select().from(platformKeys).limit(1))[0];
  return { privateKey: row.privateKey, publicKey: row.publicKey };
}

/**
 * The public key used to verify license tokens on this deployment.
 * Prefers the env var (customer deployments); falls back to the local
 * platform keypair (the vendor deployment that issues keys in-app).
 */
export async function resolveLicensePublicKey(): Promise<string | null> {
  const env = process.env.LICENSE_PUBLIC_KEY;
  if (env && env.trim()) return env.trim();
  try {
    const { getDb } = await import("@/db/client.server");
    const { platformKeys } = await import("@/db/schema");
    const db = getDb();
    const row = (await db.select().from(platformKeys).limit(1))[0];
    return row?.publicKey ?? null;
  } catch {
    return null;
  }
}
