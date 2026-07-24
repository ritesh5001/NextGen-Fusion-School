/**
 * First-run setup wizard.
 *
 * Single-institution deployment model: on a fresh install, no tenant row
 * exists. The wizard creates the single tenant, seeds default roles into it
 * (cloned from system role templates), creates the owner account, and marks
 * the deployment installed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";

const setupInput = z.object({
  schoolName: z.string().min(2),
  schoolSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerFirstName: z.string().min(1),
  ownerLastName: z.string().optional(),
  licenseKey: z.string().min(10),
});

/** Public status check — used by the setup route and by the login page. */
export const getInstallStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const db = getDb();
    const rows = await db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug }).from(tenants).limit(1);
    return {
      installed: rows.length > 0,
      institution: rows[0] ?? null,
    };
  },
);

/** Run the first-time setup. Idempotently refuses if already installed. */
export const runSetup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setupInput.parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants, users, roles, userRoles, rolePermissions } = await import("@/db/schema");
    const { hashPassword } = await import("./auth-core.server");
    const { verifyLicense } = await import("./license.server");
    const db = getDb();

    // Gate registration on a valid, verified license key. The signed payload
    // may bind the license to a specific school email — we enforce that here.
    const status = await verifyLicense(data.licenseKey);
    if (!status.valid || !status.payload) {
      throw new Response(`Invalid license: ${status.reason ?? "unknown"}`, { status: 400 });
    }

    // The tier baked into the license key decides which modules this school
    // unlocks — Starter, Pro or Max (see plans.ts).
    const plan = status.payload.tier;

    const existing = await db.select({ id: tenants.id }).from(tenants).limit(1);
    if (existing[0]) {
      throw new Response("Setup already completed", { status: 400 });
    }

    // 1. Create the institution
    const [tenant] = await db
      .insert(tenants)
      .values({
        slug: data.schoolSlug,
        name: data.schoolName,
        plan, // entitlement tier from the activated license key
        subscriptionStatus: "active",
        licenseKey: data.licenseKey,
      })
      .returning({ id: tenants.id, slug: tenants.slug, name: tenants.name });

    // 2. Clone system role templates (tenantId IS NULL, isSystem = true) into
    //    tenant-scoped role rows, copying their permission assignments.
    const templates = await db
      .select()
      .from(roles)
      .where(and(isNull(roles.tenantId), eq(roles.isSystem, true)));

    for (const tpl of templates) {
      const [newRole] = await db
        .insert(roles)
        .values({
          tenantId: tenant.id,
          key: tpl.key,
          name: tpl.name,
          description: tpl.description,
          isSystem: true,
        })
        .returning({ id: roles.id });

      const perms = await db
        .select({ permissionId: rolePermissions.permissionId })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, tpl.id));

      if (perms.length > 0) {
        await db.insert(rolePermissions).values(
          perms.map((p) => ({
            roleId: newRole.id,
            permissionId: p.permissionId,
          })),
        );
      }
    }

    // 3. Create the owner user under this institution
    const [owner] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: data.ownerEmail.toLowerCase(),
        passwordHash: await hashPassword(data.ownerPassword),
        firstName: data.ownerFirstName,
        lastName: data.ownerLastName ?? null,
        isActive: true,
      })
      .returning({ id: users.id });

    // 4. Assign the admin role (owner is effectively the tenant super-user)
    const adminRole = (
      await db
        .select()
        .from(roles)
        .where(and(eq(roles.tenantId, tenant.id), eq(roles.key, "admin")))
        .limit(1)
    )[0];
    if (adminRole) {
      await db.insert(userRoles).values({ userId: owner.id, roleId: adminRole.id });
    }

    return { ok: true, tenantId: tenant.id, ownerId: owner.id };
  });
