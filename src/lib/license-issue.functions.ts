/**
 * Vendor-side license issuance (super admin only).
 *
 * Signs new license keys with the platform private key held in `platform_keys`.
 * The private key never leaves the server; customers only ever receive the
 * signed token, so they cannot forge a key or self-issue a higher tier.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware.server";

export const getPlatformPublicKey = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isSuperAdmin) throw new Response("Forbidden", { status: 403 });
    const { getOrCreatePlatformKeys } = await import("./platform-keys.server");
    const { publicKey } = await getOrCreatePlatformKeys();
    return { publicKey };
  });

const issueInput = z.object({
  institution: z.string().min(2).max(160),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only")
    .min(2)
    .max(40)
    .optional()
    .or(z.literal("")),
  tier: z.enum(["starter", "pro", "max"]),
});

export const issueLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => issueInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.isSuperAdmin) throw new Response("Forbidden", { status: 403 });
    const { getOrCreatePlatformKeys } = await import("./platform-keys.server");
    const { signLicense } = await import("./license-crypto.server");
    const { privateKey, publicKey } = await getOrCreatePlatformKeys();

    const payload = {
      institution: data.institution,
      slug: data.slug && data.slug.length > 0 ? data.slug : null,
      tier: data.tier,
      issuedAt: new Date().toISOString().slice(0, 10),
      maxStudents: 0,
      features: ["*"],
    };
    const licenseKey = signLicense(payload, privateKey);
    return { licenseKey, publicKey, payload };
  });
