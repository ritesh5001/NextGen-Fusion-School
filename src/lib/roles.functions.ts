/**
 * Roles + Permissions grid. Tenant-scoped. Super admins can pass any tenant.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, asc, inArray } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listPermissions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { getDb } = await import("@/db/client.server");
    const { permissions } = await import("@/db/schema");
    const db = getDb();
    const rows = await db
      .select()
      .from(permissions)
      .orderBy(asc(permissions.module), asc(permissions.key));
    return rows;
  });

export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { roles, rolePermissions, users, userRoles } = await import(
      "@/db/schema"
    );
    const { sql } = await import("drizzle-orm");
    const db = getDb();

    const rs = await db
      .select({
        id: roles.id,
        key: roles.key,
        name: roles.name,
        description: roles.description,
        isSystem: roles.isSystem,
        permissionCount: sql<number>`(select count(*)::int from ${rolePermissions} where ${rolePermissions.roleId} = ${roles.id})`,
        userCount: sql<number>`(select count(*)::int from ${userRoles} inner join ${users} on ${users.id} = ${userRoles.userId} where ${userRoles.roleId} = ${roles.id} and ${users.tenantId} = ${tid})`,
      })
      .from(roles)
      .where(eq(roles.tenantId, tid))
      .orderBy(asc(roles.name));
    return rs;
  });

export const getRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ roleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { roles, rolePermissions } = await import("@/db/schema");
    const db = getDb();
    // Validate role belongs to tenant
    const r = (
      await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.id, data.roleId), eq(roles.tenantId, tid)))
        .limit(1)
    )[0];
    if (!r) throw new Response("Not found", { status: 404 });
    const rows = await db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, data.roleId));
    return rows.map((x) => x.permissionId);
  });

const setRolePermsInput = z.object({
  roleId: z.string().uuid(),
  permissionIds: z.array(z.string().uuid()),
});

export const setRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => setRolePermsInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { roles, rolePermissions } = await import("@/db/schema");
    const db = getDb();
    const r = (
      await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.id, data.roleId), eq(roles.tenantId, tid)))
        .limit(1)
    )[0];
    if (!r) throw new Response("Not found", { status: 404 });

    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, data.roleId));
    if (data.permissionIds.length) {
      await db
        .insert(rolePermissions)
        .values(
          data.permissionIds.map((pid) => ({
            roleId: data.roleId,
            permissionId: pid,
          })),
        )
        .onConflictDoNothing();
    }
    return { ok: true };
  });

const upsertRoleInput = z.object({
  id: z.string().uuid().optional(),
  key: z.string().regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscores").min(2),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
});

export const saveRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { roles } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(roles)
        .set({
          key: data.key,
          name: data.name,
          description: data.description ?? null,
        })
        .where(and(eq(roles.id, data.id), eq(roles.tenantId, tid)));
      return { ok: true, id: data.id };
    }
    const [row] = await db
      .insert(roles)
      .values({
        tenantId: tid,
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        isSystem: false,
      })
      .returning();
    return { ok: true, id: row.id };
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { roles } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(roles)
      .where(and(eq(roles.id, data.id), eq(roles.tenantId, tid)));
    return { ok: true };
  });

// Kept for future use in bulk assignment UI
export const listUsersForRoles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ roleIds: z.array(z.string().uuid()).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { users, userRoles } = await import("@/db/schema");
    const db = getDb();
    if (data.roleIds && data.roleIds.length) {
      return db
        .select({ userId: userRoles.userId, roleId: userRoles.roleId })
        .from(userRoles)
        .innerJoin(users, eq(users.id, userRoles.userId))
        .where(and(eq(users.tenantId, tid), inArray(userRoles.roleId, data.roleIds)));
    }
    return db
      .select({ userId: userRoles.userId, roleId: userRoles.roleId })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(users.tenantId, tid));
  });
