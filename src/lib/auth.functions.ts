/**
 * Auth server functions. Called from client via useServerFn / router loaders.
 *
 * IMPORTANT: This file must be safe to import from client modules — only
 * handler bodies (marked server-only) actually reach the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(), // omitted = super admin login
});

const registerInput = z.object({
  tenantSlug: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
});

const forgotInput = z.object({
  email: z.string().email(),
  tenantSlug: z.string().optional(),
});

const resetInput = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

const changePwInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/* -------------------- LOGIN -------------------- */
export const login = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginInput.parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { users, tenants, refreshTokens, userRoles, roles } = await import("@/db/schema");
    const {
      verifyPassword,
      signAccessToken,
      signRefreshToken,
    } = await import("./auth-core.server");
    const { loadEffectivePermissions } = await import("./permissions.server");

    const db = getDb();

    // Single-institution mode: auto-resolve to the sole tenant if the caller
    // didn't specify a slug. Falls back to super-admin (tenantId=NULL) if the
    // email doesn't match under that tenant.
    let tenantId: string | null = null;
    if (data.tenantSlug) {
      const t = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, data.tenantSlug))
        .limit(1);
      if (!t[0]) throw new Response("Invalid credentials", { status: 401 });
      tenantId = t[0].id;
    } else {
      const allTenants = await db.select({ id: tenants.id }).from(tenants).limit(2);
      if (allTenants.length === 1) tenantId = allTenants[0].id;
    }

    let row = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, data.email.toLowerCase()),
          tenantId ? eq(users.tenantId, tenantId) : isNull(users.tenantId),
        ),
      )
      .limit(1);

    // Fallback: try super-admin (tenantId NULL) if no match under the auto-resolved tenant.
    if (!row[0] && tenantId && !data.tenantSlug) {
      row = await db
        .select()
        .from(users)
        .where(and(eq(users.email, data.email.toLowerCase()), isNull(users.tenantId)))
        .limit(1);
    }

    const user = row[0];
    if (!user || !user.isActive) {
      throw new Response("Invalid credentials", { status: 401 });
    }
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) throw new Response("Invalid credentials", { status: 401 });

    const perms = user.isSuperAdmin
      ? ["*"]
      : await loadEffectivePermissions(user.id);

    // Single-institution mode: super-admin without a tenant adopts the sole tenant
    // so all tenant-scoped modules work out of the box.
    let effectiveTid = user.tenantId;
    if (!effectiveTid && user.isSuperAdmin) {
      const allT = await db.select({ id: tenants.id }).from(tenants).limit(2);
      if (allT.length === 1) effectiveTid = allT[0].id;
    }

    const access = await signAccessToken({
      sub: user.id,
      tid: effectiveTid,
      sa: user.isSuperAdmin,
      perms,
    });
    const refresh = await signRefreshToken(user.id);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: refresh.tokenHash,
      userAgent: getRequestHeader("user-agent") ?? null,
      expiresAt: refresh.expiresAt,
    });

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Role keys drive the post-login redirect (student → portal, etc.)
    const roleRows = await db
      .select({ key: roles.key })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));
    const roleKeys = roleRows.map((r) => r.key);

    let tenant: { id: string; name: string; slug: string; plan: string } | null = null;
    if (effectiveTid) {
      const tRow = (
        await db
          .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, plan: tenants.plan })
          .from(tenants)
          .where(eq(tenants.id, effectiveTid))
          .limit(1)
      )[0];
      if (tRow) tenant = tRow;
    }

    return {
      accessToken: access,
      refreshToken: refresh.token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: effectiveTid,
        isSuperAdmin: user.isSuperAdmin,
        perms,
        roleKeys,
        tenant,
      },
    };
  });

/* -------------------- REFRESH -------------------- */
export const refresh = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ refreshToken: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { refreshTokens, users } = await import("@/db/schema");
    const {
      verifyRefreshToken,
      hashToken,
      signAccessToken,
      signRefreshToken,
    } = await import("./auth-core.server");
    const { loadEffectivePermissions } = await import("./permissions.server");

    const db = getDb();
    let sub: string;
    try {
      ({ sub } = await verifyRefreshToken(data.refreshToken));
    } catch {
      throw new Response("Invalid refresh token", { status: 401 });
    }

    const th = hashToken(data.refreshToken);
    const existing = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, th))
      .limit(1);
    const rec = existing[0];
    if (!rec || rec.revokedAt || rec.expiresAt < new Date()) {
      throw new Response("Invalid refresh token", { status: 401 });
    }
    if (rec.userId !== sub) {
      throw new Response("Invalid refresh token", { status: 401 });
    }

    // Rotate
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, rec.id));

    const u = (
      await db.select().from(users).where(eq(users.id, sub)).limit(1)
    )[0];
    if (!u || !u.isActive) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const perms = u.isSuperAdmin
      ? ["*"]
      : await loadEffectivePermissions(u.id);

    const access = await signAccessToken({
      sub: u.id,
      tid: u.tenantId,
      sa: u.isSuperAdmin,
      perms,
    });
    const nextRefresh = await signRefreshToken(u.id);
    await db.insert(refreshTokens).values({
      userId: u.id,
      tokenHash: nextRefresh.tokenHash,
      expiresAt: nextRefresh.expiresAt,
    });
    return { accessToken: access, refreshToken: nextRefresh.token };
  });

/* -------------------- LOGOUT -------------------- */
export const logout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ refreshToken: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.refreshToken) return { ok: true };
    const { getDb } = await import("@/db/client.server");
    const { refreshTokens } = await import("@/db/schema");
    const { hashToken } = await import("./auth-core.server");
    const db = getDb();
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(data.refreshToken)));
    return { ok: true };
  });

/* -------------------- ME -------------------- */
export const me = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/db/client.server");
    const { users, tenants } = await import("@/db/schema");
    const db = getDb();
    const u = (
      await db.select().from(users).where(eq(users.id, context.userId)).limit(1)
    )[0];
    if (!u) throw new Response("Unauthorized", { status: 401 });
    const tenant = u.tenantId
      ? (
          await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, u.tenantId))
            .limit(1)
        )[0]
      : null;
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      isSuperAdmin: u.isSuperAdmin,
      tenant: tenant
        ? { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan }
        : null,
      perms: context.perms,
    };
  });

/* -------------------- REGISTER (tenant admin bootstrap) -------------------- */
export const registerTenantAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registerInput.parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { users, tenants, roles, userRoles } = await import("@/db/schema");
    const { hashPassword } = await import("./auth-core.server");
    const db = getDb();

    const tenant = (
      await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, data.tenantSlug))
        .limit(1)
    )[0];
    if (!tenant) throw new Response("Tenant not found", { status: 404 });

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.email, data.email.toLowerCase()),
          eq(users.tenantId, tenant.id),
        ),
      )
      .limit(1);
    if (existing[0]) throw new Response("Email already registered", { status: 409 });

    const [u] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName ?? null,
      })
      .returning({ id: users.id });

    const adminRole = (
      await db
        .select()
        .from(roles)
        .where(and(eq(roles.tenantId, tenant.id), eq(roles.key, "admin")))
        .limit(1)
    )[0];
    if (adminRole) {
      await db.insert(userRoles).values({ userId: u.id, roleId: adminRole.id });
    }
    return { ok: true, userId: u.id };
  });

/* -------------------- FORGOT PASSWORD -------------------- */
export const forgotPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => forgotInput.parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { users, tenants, passwordResets } = await import("@/db/schema");
    const { randomToken, hashToken } = await import("./auth-core.server");
    const db = getDb();

    let tenantId: string | null = null;
    if (data.tenantSlug) {
      const t = (
        await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.slug, data.tenantSlug))
          .limit(1)
      )[0];
      if (!t) return { ok: true }; // don't leak
      tenantId = t.id;
    }
    const u = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, data.email.toLowerCase()),
            tenantId ? eq(users.tenantId, tenantId) : isNull(users.tenantId),
          ),
        )
        .limit(1)
    )[0];
    if (!u) return { ok: true };

    const token = randomToken(32);
    await db.insert(passwordResets).values({
      userId: u.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // In production, email this link. For now return the URL so we can wire it in.
    const appUrl = process.env.APP_URL ?? "http://localhost:8080";
    const resetUrl = `${appUrl}/auth/reset?token=${token}`;
    console.log("[password-reset]", data.email, resetUrl);
    return { ok: true };
  });

/* -------------------- RESET PASSWORD -------------------- */
export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resetInput.parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { users, passwordResets } = await import("@/db/schema");
    const { hashPassword, hashToken } = await import("./auth-core.server");
    const db = getDb();

    const rec = (
      await db
        .select()
        .from(passwordResets)
        .where(eq(passwordResets.tokenHash, hashToken(data.token)))
        .limit(1)
    )[0];
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      throw new Response("Invalid or expired token", { status: 400 });
    }
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(data.password) })
      .where(eq(users.id, rec.userId));
    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, rec.id));
    return { ok: true };
  });

/* -------------------- CHANGE PASSWORD -------------------- */
export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => changePwInput.parse(d))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/db/client.server");
    const { users } = await import("@/db/schema");
    const { hashPassword, verifyPassword } = await import("./auth-core.server");
    const db = getDb();
    const u = (
      await db.select().from(users).where(eq(users.id, context.userId)).limit(1)
    )[0];
    if (!u) throw new Response("Unauthorized", { status: 401 });
    if (!(await verifyPassword(data.currentPassword, u.passwordHash))) {
      throw new Response("Current password is incorrect", { status: 400 });
    }
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(data.newPassword) })
      .where(eq(users.id, u.id));
    return { ok: true };
  });
