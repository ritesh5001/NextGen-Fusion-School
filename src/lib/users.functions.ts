/**
 * User Management — tenant-scoped CRUD for staff/system users.
 * Super admins can pass tenantId; tenant admins operate on their own tenant.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, ilike, or, sql, desc, inArray } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

const listInput = z.object({
  query: z.string().optional(),
  roleId: z.string().uuid().optional(),
  active: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { users, userRoles, roles } = await import("@/db/schema");
    const db = getDb();

    const conds = [eq(users.tenantId, tid)];
    if (data.query) {
      const q = `%${data.query.trim()}%`;
      conds.push(
        or(
          ilike(users.email, q),
          ilike(users.firstName, q),
          ilike(users.lastName, q),
        )!,
      );
    }
    if (data.active === "active") conds.push(eq(users.isActive, true));
    if (data.active === "inactive") conds.push(eq(users.isActive, false));

    const totalRow = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(and(...conds));
    const total = totalRow[0]?.c ?? 0;

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(...conds))
      .orderBy(desc(users.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);

    // load roles per user
    const ids = rows.map((r) => r.id);
    const roleMap = new Map<string, { id: string; name: string; key: string }[]>();
    if (ids.length) {
      const rr = await db
        .select({
          userId: userRoles.userId,
          roleId: roles.id,
          roleName: roles.name,
          roleKey: roles.key,
        })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(inArray(userRoles.userId, ids));
      for (const r of rr) {
        const list = roleMap.get(r.userId) ?? [];
        list.push({ id: r.roleId, name: r.roleName, key: r.roleKey });
        roleMap.set(r.userId, list);
      }
    }

    // filter by role client-side after fetch (simpler than SQL join here)
    let out = rows.map((r) => ({ ...r, roles: roleMap.get(r.id) ?? [] }));
    if (data.roleId) {
      out = out.filter((r) => r.roles.some((x) => x.id === data.roleId));
    }
    return { rows: out, total };
  });

const saveInput = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
  roleIds: z.array(z.string().uuid()).default([]),
  isActive: z.boolean().default(true),
});

export const saveUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => saveInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { users, userRoles, roles } = await import("@/db/schema");
    const { hashPassword } = await import("./auth-core.server");
    const db = getDb();

    // Validate roles belong to this tenant
    if (data.roleIds.length) {
      const valid = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.tenantId, tid), inArray(roles.id, data.roleIds)));
      if (valid.length !== data.roleIds.length) {
        throw new Response("Invalid role selection", { status: 400 });
      }
    }

    let userId = data.id;
    if (userId) {
      // Update
      const existing = (
        await db
          .select()
          .from(users)
          .where(and(eq(users.id, userId), eq(users.tenantId, tid)))
          .limit(1)
      )[0];
      if (!existing) throw new Response("Not found", { status: 404 });

      const patch: Record<string, unknown> = {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        isActive: data.isActive,
        updatedAt: new Date(),
      };
      if (data.password) patch.passwordHash = await hashPassword(data.password);
      await db.update(users).set(patch).where(eq(users.id, userId));
    } else {
      if (!data.password) {
        throw new Response("Password required for new users", { status: 400 });
      }
      // Uniqueness
      const dup = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tid),
            eq(users.email, data.email.toLowerCase()),
          ),
        )
        .limit(1);
      if (dup[0]) throw new Response("Email already in use", { status: 409 });

      const [row] = await db
        .insert(users)
        .values({
          tenantId: tid,
          email: data.email.toLowerCase(),
          passwordHash: await hashPassword(data.password),
          firstName: data.firstName,
          lastName: data.lastName ?? null,
          phone: data.phone ?? null,
          isActive: data.isActive,
        })
        .returning({ id: users.id });
      userId = row.id;
    }

    // Sync roles
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    if (data.roleIds.length) {
      await db
        .insert(userRoles)
        .values(data.roleIds.map((rid) => ({ userId: userId!, roleId: rid })))
        .onConflictDoNothing();
    }
    return { ok: true, id: userId };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { users } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(users)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(and(eq(users.id, data.id), eq(users.tenantId, tid)));
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), newPassword: z.string().min(8) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { users, refreshTokens } = await import("@/db/schema");
    const { hashPassword } = await import("./auth-core.server");
    const db = getDb();

    const u = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, data.id), eq(users.tenantId, tid)))
        .limit(1)
    )[0];
    if (!u) throw new Response("Not found", { status: 404 });

    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(data.newPassword),
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.id));
    // Revoke sessions
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, data.id));
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { users } = await import("@/db/schema");
    const db = getDb();
    if (data.id === context.userId) {
      throw new Response("Cannot delete your own account", { status: 400 });
    }
    await db
      .delete(users)
      .where(and(eq(users.id, data.id), eq(users.tenantId, tid)));
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        avatarUrl: z.string().url().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/db/client.server");
    const { users } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(users)
      .set({
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        avatarUrl: data.avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, context.userId));
    return { ok: true };
  });
