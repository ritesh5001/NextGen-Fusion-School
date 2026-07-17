/**
 * Server-only auth primitives: password hashing + JWT sign/verify.
 *
 * Uses `bcryptjs` (pure JS, works on any runtime) and `jose` (Web Crypto).
 * Portable across Node, Cloudflare Workers, and Bun deploys.
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, createHash } from "node:crypto";

export type AccessClaims = {
  sub: string; // user id
  tid: string | null; // tenant id (null for super admin)
  sa: boolean; // is super admin
  perms: string[]; // effective permission keys (may be truncated for size)
};

function accessSecret(): Uint8Array {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_ACCESS_SECRET is not set");
  return new TextEncoder().encode(s);
}
function refreshSecret(): Uint8Array {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_REFRESH_SECRET is not set");
  return new TextEncoder().encode(s);
}
function accessTtl(): number {
  return Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
}
function refreshTtl(): number {
  return Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 60 * 60 * 24 * 14);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + accessTtl())
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessSecret());
  return payload as unknown as AccessClaims;
}

export async function signRefreshToken(userId: string): Promise<{
  token: string;
  tokenHash: string;
  expiresAt: Date;
}> {
  const raw = randomBytes(48).toString("base64url");
  const jwt = await new SignJWT({ sub: userId, jti: raw })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + refreshTtl())
    .sign(refreshSecret());
  const tokenHash = createHash("sha256").update(jwt).digest("hex");
  return {
    token: jwt,
    tokenHash,
    expiresAt: new Date(Date.now() + refreshTtl() * 1000),
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, refreshSecret());
  return { sub: payload.sub as string };
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
