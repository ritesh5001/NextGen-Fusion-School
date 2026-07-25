/**
 * License status + activation server functions.
 *
 * Verifies the tenant's signed license key against the vendor's ed25519 public
 * key. Activation is authenticated, permission-gated, rate-limited, and
 * audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth, requireAccess } from "./auth-middleware.server";

export const getLicenseStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const { verifyLicense } = await import("./license.server");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const rows = context.tenantId
      ? await db
          .select({ id: tenants.id, name: tenants.name, licenseKey: tenants.licenseKey })
          .from(tenants)
          .where(eq(tenants.id, context.tenantId))
          .limit(1)
      : await db
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
  });

// Max license activations accepted per tenant per hour (anti brute-force).
const ACTIVATION_RATE_LIMIT = 5;

export const setLicenseKey = createServerFn({ method: "POST" })
  .middleware([
    requireAccess({ anyPerm: ["settings.create", "settings.update", "settings.delete"] }),
  ])
  .inputValidator((d: unknown) =>
    z.object({ licenseKey: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants, auditLog } = await import("@/db/schema");
    const { verifyLicense } = await import("./license.server");
    const { and, eq, gt, sql } = await import("drizzle-orm");
    const db = getDb();

    if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
    const tenantId = context.tenantId;

    // Rate-limit activation attempts using the audit log.
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenantId),
          eq(auditLog.action, "license.activate"),
          gt(auditLog.createdAt, since),
        ),
      );
    if ((recent[0]?.n ?? 0) >= ACTIVATION_RATE_LIMIT) {
      throw new Response("Too many activation attempts. Try again later.", {
        status: 429,
      });
    }

    const status = await verifyLicense(data.licenseKey);
    if (!status.valid || !status.payload) {
      // Audit the failed attempt too (counts toward the rate limit).
      await db.insert(auditLog).values({
        tenantId,
        userId: context.isSuperAdmin ? null : context.userId,
        action: "license.activate",
        entity: "tenant",
        entityId: tenantId,
        meta: JSON.stringify({ ok: false, reason: status.reason ?? "invalid" }),
      });
      throw new Response(`Invalid license: ${status.reason ?? "unknown"}`, {
        status: 400,
      });
    }

    const tenant = (
      await db
        .select({ id: tenants.id, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1)
    )[0];
    if (!tenant) throw new Response("Not installed", { status: 400 });

    // Tenant binding: a slug-bound key can only be activated on its school.
    if (status.payload.slug && status.payload.slug !== tenant.slug) {
      throw new Response(
        `This license key is bound to "${status.payload.slug}", not this school.`,
        { status: 400 },
      );
    }

    // Activating a key (re)sets the plan to that key's tier — upgrading is just
    // activating a higher-tier key.
    await db
      .update(tenants)
      .set({ licenseKey: data.licenseKey, plan: status.payload.tier })
      .where(eq(tenants.id, tenantId));

    await db.insert(auditLog).values({
      tenantId,
      userId: context.isSuperAdmin ? null : context.userId,
      action: "license.activate",
      entity: "tenant",
      entityId: tenantId,
      meta: JSON.stringify({
        ok: true,
        tier: status.payload.tier,
        via: "settings",
        institution: status.payload.institution ?? null,
      }),
    });

    return { ok: true, status };
  });
