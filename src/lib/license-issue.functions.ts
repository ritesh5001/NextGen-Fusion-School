/**
 * Vendor-side license issuance. Signs a license payload with an ed25519
 * private key. On first use, if `LICENSE_PRIVATE_KEY` is not set in the
 * environment, a fresh keypair is auto-generated and persisted in the
 * `platform_keys` table so the platform admin can issue keys directly from
 * the dashboard with zero shell/env setup.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware.server";

function toB64Url(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return new Uint8Array(Buffer.from(s + "=".repeat(pad), "base64"));
}

/**
 * Resolve or lazily create the vendor signing keypair.
 * Priority: env vars → DB row → generate + persist.
 */
async function loadOrCreateKeys(): Promise<{ priv: string; pub: string }> {
  const envPriv = process.env.LICENSE_PRIVATE_KEY;
  const envPub = process.env.LICENSE_PUBLIC_KEY;
  if (envPriv && envPub) return { priv: envPriv, pub: envPub };

  const { getDb } = await import("@/db/client.server");
  const { platformKeys } = await import("@/db/schema");
  const db = getDb();
  const existing = await db.select().from(platformKeys).limit(1);
  if (existing[0]) {
    return { priv: existing[0].privateKey, pub: existing[0].publicKey };
  }

  const ed = await import("@noble/ed25519");
  const { sha512 } = await import("@noble/hashes/sha2.js");
  ed.hashes.sha512 = sha512;
  const privBytes = ed.utils.randomSecretKey();
  const pubBytes = await ed.getPublicKey(privBytes);
  const priv = toB64Url(privBytes);
  const pub = toB64Url(pubBytes);
  await db.insert(platformKeys).values({ id: 1, privateKey: priv, publicKey: pub });
  return { priv, pub };
}

const issueInput = z.object({
  institution: z.string().min(2),
  email: z.string().email(),
  expiresAt: z.string().optional().nullable(),
  maxStudents: z.number().int().min(0).default(0),
  features: z.array(z.string()).default(["*"]),
});

export const issueLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => issueInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.isSuperAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }
    const { priv } = await loadOrCreateKeys();
    const ed = await import("@noble/ed25519");
    const { sha512 } = await import("@noble/hashes/sha2.js");
    ed.hashes.sha512 = sha512;
    const payload = {
      institution: data.institution,
      email: data.email.toLowerCase(),
      issuedAt: new Date().toISOString().slice(0, 10),
      expiresAt: data.expiresAt || null,
      maxStudents: data.maxStudents,
      features: data.features?.length ? data.features : ["*"],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const sig = await ed.sign(bytes, fromB64Url(priv));
    const licenseKey = `${toB64Url(bytes)}.${toB64Url(sig)}`;
    return { licenseKey, payload };
  });

/** Status check + returns the public key so admin can copy it to schools. */
export const getIssuerStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isSuperAdmin) throw new Response("Forbidden", { status: 403 });
    const { pub } = await loadOrCreateKeys();
    return {
      hasPrivateKey: true,
      hasPublicKey: true,
      publicKey: pub,
    };
  });
