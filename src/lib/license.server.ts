/**
 * License validation for single-institution deployments.
 *
 * The public key is read from `LICENSE_PUBLIC_KEY` if set, otherwise from
 * the `platform_keys` DB row (auto-populated on the vendor deployment).
 * This lets both the vendor and school deployments verify without any env
 * setup — the vendor deployment issues + verifies with its own keypair.
 */
import { verify as edVerify } from "@noble/ed25519";

export interface LicensePayload {
  institution: string;
  issuedAt: string;
  expiresAt: string | null;
  maxStudents: number;
  features: string[];
}

export interface LicenseStatus {
  valid: boolean;
  payload: LicensePayload | null;
  reason?: string;
  expiresInDays?: number | null;
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const buf = Buffer.from(s + "=".repeat(pad), "base64");
  return new Uint8Array(buf);
}

async function resolvePublicKey(): Promise<string> {
  if (process.env.LICENSE_PUBLIC_KEY) return process.env.LICENSE_PUBLIC_KEY;
  try {
    const { getDb } = await import("@/db/client.server");
    const { platformKeys } = await import("@/db/schema");
    const db = getDb();
    const row = (await db.select().from(platformKeys).limit(1))[0];
    return row?.publicKey ?? "";
  } catch {
    return "";
  }
}

export async function verifyLicense(licenseKey: string): Promise<LicenseStatus> {
  if (!licenseKey) return { valid: false, payload: null, reason: "No license" };
  const publicKey = await resolvePublicKey();
  if (!publicKey) return { valid: false, payload: null, reason: "No public key configured" };

  const [payloadB64, sigB64] = licenseKey.split(".");
  if (!payloadB64 || !sigB64) return { valid: false, payload: null, reason: "Malformed license" };

  try {
    const payloadBytes = b64urlDecode(payloadB64);
    const sig = b64urlDecode(sigB64);
    const pub = b64urlDecode(publicKey);
    const ok = await edVerify(sig, payloadBytes, pub);
    if (!ok) return { valid: false, payload: null, reason: "Invalid signature" };

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as LicensePayload;
    let expiresInDays: number | null = null;
    if (payload.expiresAt) {
      const days = Math.floor((new Date(payload.expiresAt).getTime() - Date.now()) / 86400000);
      expiresInDays = days;
      if (days < 0) {
        return { valid: false, payload, reason: "License expired", expiresInDays: days };
      }
    }
    return { valid: true, payload, expiresInDays };
  } catch (e) {
    return { valid: false, payload: null, reason: (e as Error).message };
  }
}
