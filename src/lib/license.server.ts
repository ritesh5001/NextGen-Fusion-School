/**
 * License validation for single-institution deployments.
 *
 * A license is a base64url-encoded JSON payload followed by a "." and an
 * ed25519 signature (base64url) of that payload. The public key is embedded
 * here at build time so the app can verify offline. The matching private key
 * lives only on the vendor's machine and is used by scripts/issue-license.mjs.
 *
 * Payload shape:
 *   {
 *     "institution": "St. Xavier's High School",
 *     "issuedAt":    "2026-07-18",
 *     "expiresAt":   "2027-07-18",   // AMC expiry (nullable = perpetual)
 *     "maxStudents": 2000,           // 0 = unlimited
 *     "features":    ["*"]           // "*" or list of module keys
 *   }
 *
 * Missing / invalid license: the app still runs but shows an "Unlicensed"
 * banner in the sidebar. This is intentional — schools should never be locked
 * out of their own data.
 */
import { verify as edVerify } from "@noble/ed25519";

/**
 * Vendor public key (base64url, 32 bytes / ed25519).
 * Replace with your real public key before shipping.
 */
const PUBLIC_KEY_B64URL = process.env.LICENSE_PUBLIC_KEY ?? "";

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

export async function verifyLicense(licenseKey: string): Promise<LicenseStatus> {
  if (!licenseKey) return { valid: false, payload: null, reason: "No license" };
  if (!PUBLIC_KEY_B64URL) return { valid: false, payload: null, reason: "No public key configured" };

  const [payloadB64, sigB64] = licenseKey.split(".");
  if (!payloadB64 || !sigB64) return { valid: false, payload: null, reason: "Malformed license" };

  try {
    const payloadBytes = b64urlDecode(payloadB64);
    const sig = b64urlDecode(sigB64);
    const pub = b64urlDecode(PUBLIC_KEY_B64URL);
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
