/**
 * Super-admin CRUD for tenants (schools) + tenant onboarding.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function ensureSuperAdmin(ctx: { isSuperAdmin: boolean }) {
  if (!ctx.isSuperAdmin) throw new Response("Forbidden", { status: 403 });
}

export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureSuperAdmin(context);
    const { getDb } = await import("@/db/client.server");
    const { tenants, users } = await import("@/db/schema");
    const { sql, eq: eqOp } = await import("drizzle-orm");
    const db = getDb();
    const rows = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        plan: tenants.plan,
        subscriptionStatus: tenants.subscriptionStatus,
        createdAt: tenants.createdAt,
        userCount: sql<number>`(select count(*)::int from ${users} where ${users.tenantId} = ${tenants.id})`,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt));
    return rows;
  });

const createTenantInput = z.object({
  slug: z.string().regex(slugRe, "Lowercase letters, digits, hyphens").min(2).max(40),
  name: z.string().min(2).max(120),
  plan: z.enum(["starter", "pro", "max"]).default("starter"),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().optional(),
});

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => createTenantInput.parse(d))
  .handler(async ({ data, context }) => {
    ensureSuperAdmin(context);
    const { getDb } = await import("@/db/client.server");
    const {
      tenants,
      users,
      roles,
      rolePermissions,
      userRoles,
      permissions,
      instituteSettings,
    } = await import("@/db/schema");
    const { hashPassword } = await import("./auth-core.server");
    const db = getDb();

    // Uniqueness
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, data.slug))
      .limit(1);
    if (existing[0]) throw new Response("Slug already in use", { status: 409 });

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

    const [t] = await db
      .insert(tenants)
      .values({
        slug: data.slug,
        name: data.name,
        plan: data.plan,
        trialEndsAt: trialEnd,
      })
      .returning();

    // Seed default settings
    await db.insert(instituteSettings).values({ tenantId: t.id });

    // Copy system role templates into this tenant
    const templates = await db
      .select()
      .from(roles)
      .where(eq(roles.isSystem, true));
    const perms = await db.select().from(permissions);
    const permByKey = new Map(perms.map((p) => [p.key, p.id]));

    const roleIdByKey = new Map<string, string>();
    for (const tpl of templates) {
      const [r] = await db
        .insert(roles)
        .values({
          tenantId: t.id,
          key: tpl.key,
          name: tpl.name,
          description: tpl.description,
          isSystem: false,
        })
        .returning();
      roleIdByKey.set(tpl.key, r.id);

      // Copy permissions from template
      const tplPerms = await db
        .select({ pid: rolePermissions.permissionId })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, tpl.id));
      if (tplPerms.length) {
        await db
          .insert(rolePermissions)
          .values(tplPerms.map((rp) => ({ roleId: r.id, permissionId: rp.pid })))
          .onConflictDoNothing();
      }
    }

    // Create admin user
    const [adminUser] = await db
      .insert(users)
      .values({
        tenantId: t.id,
        email: data.adminEmail.toLowerCase(),
        passwordHash: await hashPassword(data.adminPassword),
        firstName: data.adminFirstName,
        lastName: data.adminLastName ?? null,
      })
      .returning({ id: users.id });

    const adminRoleId = roleIdByKey.get("admin");
    if (adminRoleId) {
      await db
        .insert(userRoles)
        .values({ userId: adminUser.id, roleId: adminRoleId });
    }

    // Suppress unused var warning (permByKey reserved for future expansion checks)
    void permByKey;

    return { ok: true, tenant: t };
  });

const updateTenantInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).optional(),
  plan: z.enum(["starter", "pro", "max"]).optional(),
  subscriptionStatus: z
    .enum(["trialing", "active", "past_due", "canceled", "expired"])
    .optional(),
});

export const updateTenant = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => updateTenantInput.parse(d))
  .handler(async ({ data, context }) => {
    ensureSuperAdmin(context);
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const db = getDb();
    const { id, ...rest } = data;
    await db
      .update(tenants)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(tenants.id, id));
    return { ok: true };
  });

export const deleteTenant = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    ensureSuperAdmin(context);
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const db = getDb();
    await db.delete(tenants).where(eq(tenants.id, data.id));
    return { ok: true };
  });
