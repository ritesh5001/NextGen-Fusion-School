/**
 * Server-only ed25519 primitives for signed license keys.
 *
 * A license key is `base64url(payloadJSON).base64url(signature)`. The vendor
 * signs the payload with a private key that never leaves their control; the
 * customer deployment only holds the public key (env LICENSE_PUBLIC_KEY, or the
 * vendor deployment's own `platform_keys` row) and can verify but not forge or
 * self-issue a key.
 *
 * Uses Node's built-in WebCrypto-backed `node:crypto` ed25519 (portable across
 * Node and Bun) — keys are stored as raw 32-byte seeds, base64url-encoded, the
 * same format the `issue-license` CLI emits.
 */
import crypto from "node:crypto";

// Standard DER wrappers for a raw 32-byte ed25519 key.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex"); // public
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex"); // private seed

export function b64url(buf: Uint8Array | Buffer): string {
  return Buffer.from(buf).toString("base64url");
}
export function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function publicKeyFromRaw(rawB64url: string): crypto.KeyObject {
  const der = Buffer.concat([SPKI_PREFIX, fromB64url(rawB64url)]);
  return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
}
function privateKeyFromRaw(rawB64url: string): crypto.KeyObject {
  const der = Buffer.concat([PKCS8_PREFIX, fromB64url(rawB64url)]);
  return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

/** Generate a fresh signing keypair as raw base64url seeds. */
export function generateKeypair(): { privateKey: string; publicKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "jwk" }) as { x: string };
  const priv = privateKey.export({ format: "jwk" }) as { d: string };
  return { privateKey: priv.d, publicKey: pub.x };
}

/** Sign an arbitrary payload object, returning the `payload.sig` license key. */
export function signLicense(
  payload: Record<string, unknown>,
  privateKeyB64: string,
): string {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = crypto.sign(null, payloadBytes, privateKeyFromRaw(privateKeyB64));
  return `${b64url(payloadBytes)}.${b64url(sig)}`;
}

/**
 * Verify a license key against a public key. Returns the decoded payload on
 * success, or null if the format is wrong or the signature doesn't match.
 */
export function verifyLicenseToken(
  token: string,
  publicKeyB64: string,
): Record<string, unknown> | null {
  const parts = token.trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  let payloadBytes: Buffer;
  let sig: Buffer;
  try {
    payloadBytes = fromB64url(parts[0]);
    sig = fromB64url(parts[1]);
  } catch {
    return null;
  }
  let ok = false;
  try {
    ok = crypto.verify(null, payloadBytes, publicKeyFromRaw(publicKeyB64), sig);
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(payloadBytes)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}
