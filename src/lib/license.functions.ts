/**
 * License status + activation server functions.
 * Reads the license from the single institution row and verifies it
 * against the vendor's ed25519 public key.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getLicenseStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const { verifyLicense } = await import("./license.server");
    const db = getDb();
    const rows = await db
      .select({ id: tenants.id, name: tenants.name, licenseKey: tenants.licenseKey })
      .from(tenants)
      .limit(1);
    if (!rows[0]) return { installed: false, status: null };
    const status = await verifyLicense(rows[0].licenseKey ?? "");
    return {
      installed: true,
      institution: { id: rows[0].id, name: rows[0].name },
      hasKey: !!rows[0].licenseKey,
      status,
    };
  },
);

export const setLicenseKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ licenseKey: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const { verifyLicense } = await import("./license.server");
    const status = await verifyLicense(data.licenseKey);
    if (!status.valid) {
      throw new Response(`Invalid license: ${status.reason ?? "unknown"}`, {
        status: 400,
      });
    }
    const db = getDb();
    const rows = await db.select({ id: tenants.id }).from(tenants).limit(1);
    if (!rows[0]) throw new Response("Not installed", { status: 400 });
    const { eq } = await import("drizzle-orm");
    await db
      .update(tenants)
      .set({ licenseKey: data.licenseKey })
      .where(eq(tenants.id, rows[0].id));
    return { ok: true, status };
  });
