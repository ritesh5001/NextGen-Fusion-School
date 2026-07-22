/**
 * Vendor-side license issuance. Signs a license payload with the
 * `LICENSE_PRIVATE_KEY` environment variable (base64url ed25519 secret) so
 * the platform super-admin can generate keys for schools directly from the
 * admin panel — no shell access required.
 *
 * The generated key can be pasted into the school's own deployment on the
 * /setup page (their deployment holds only LICENSE_PUBLIC_KEY and verifies
 * offline).
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

const issueInput = z.object({
  institution: z.string().min(2),
  email: z.string().email(),
  expiresAt: z.string().optional().nullable(), // ISO date, null = perpetual
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
    const priv = process.env.LICENSE_PRIVATE_KEY;
    if (!priv) {
      throw new Response(
        "LICENSE_PRIVATE_KEY is not configured on the server. Add it in Secrets and redeploy.",
        { status: 500 },
      );
    }
    const { sign } = await import("@noble/ed25519");
    const payload = {
      institution: data.institution,
      email: data.email.toLowerCase(),
      issuedAt: new Date().toISOString().slice(0, 10),
      expiresAt: data.expiresAt || null,
      maxStudents: data.maxStudents,
      features: data.features?.length ? data.features : ["*"],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const sig = await sign(bytes, fromB64Url(priv));
    const licenseKey = `${toB64Url(bytes)}.${toB64Url(sig)}`;
    return { licenseKey, payload };
  });

/** Non-secret status check so the UI can nudge to configure keys. */
export const getIssuerStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isSuperAdmin) throw new Response("Forbidden", { status: 403 });
    return {
      hasPrivateKey: !!process.env.LICENSE_PRIVATE_KEY,
      hasPublicKey: !!process.env.LICENSE_PUBLIC_KEY,
    };
  });
