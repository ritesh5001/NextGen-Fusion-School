/**
 * Vendor-side license management.
 *
 * Licenses are a fixed list of 30 seeded, tiered keys (see `license-keys.ts`).
 * The admin panel just lists them; no signing / issuance happens at runtime.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware.server";
import { LICENSE_KEYS } from "./license-keys";

export const listLicenseKeys = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isSuperAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }
    return { keys: LICENSE_KEYS };
  });
