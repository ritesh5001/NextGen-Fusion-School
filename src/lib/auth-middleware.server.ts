/**
 * Server-fn middleware: attaches the authenticated user to `context`.
 *
 * Requires a client-side `functionMiddleware` (in src/start.ts) that puts the
 * access token into the `Authorization: Bearer <jwt>` header.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { verifyAccessToken, type AccessClaims } from "./auth-core.server";
import { toPlanTier, planAtLeast, PLAN_LABELS, type PlanTier } from "./plans";

export type AuthContext = {
  userId: string;
  tenantId: string | null;
  isSuperAdmin: boolean;
  perms: string[];
  claims: AccessClaims;
};

export const requireAuth = createMiddleware().server(async ({ next }) => {
  const header =
    getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = header.slice(7).trim();
  let claims: AccessClaims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw new Response("Unauthorized", { status: 401 });
  }
  return next({
    context: {
      userId: claims.sub,
      tenantId: claims.tid,
      isSuperAdmin: claims.sa,
      perms: claims.perms,
      claims,
    } satisfies AuthContext,
  });
});

/**
 * Plan-tier gate. Chain this INSTEAD of `requireAuth` on any server function
 * that belongs to a paid module (see src/lib/plans.ts). It depends on
 * `requireAuth`, so authentication still runs exactly once and the downstream
 * handler keeps the full `AuthContext`.
 *
 * The tenant's current plan is read fresh from the DB on every call, so an
 * upgrade (activating a higher-tier license key) takes effect immediately and
 * a stale access token can't be used to reach a locked module. Super admins
 * (the vendor operator) bypass the gate.
 *
 * Usage: `.middleware([requirePlan("pro")])`
 */
export function requirePlan(minTier: PlanTier) {
  return createMiddleware()
    .middleware([requireAuth])
    .server(async ({ next, context }) => {
      if (!context.isSuperAdmin) {
        if (!context.tenantId) {
          throw new Response("Tenant scope required", { status: 400 });
        }
        const { getDb } = await import("@/db/client.server");
        const { tenants } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const db = getDb();
        const rows = await db
          .select({ plan: tenants.plan })
          .from(tenants)
          .where(eq(tenants.id, context.tenantId))
          .limit(1);
        const plan = toPlanTier(rows[0]?.plan ?? null);
        if (!planAtLeast(plan, minTier)) {
          throw new Response(
            `This feature requires the ${PLAN_LABELS[minTier]} plan. Upgrade your license to continue.`,
            { status: 403 },
          );
        }
      }
      return next();
    });
}

/**
 * Optional variant that DOES NOT throw when unauthenticated — attaches
 * `auth: null` instead. Useful for public endpoints that also personalize.
 */
export const optionalAuth = createMiddleware().server(async ({ next }) => {
  const header =
    getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  let auth: AuthContext | null = null;
  if (header && header.toLowerCase().startsWith("bearer ")) {
    try {
      const claims = await verifyAccessToken(header.slice(7).trim());
      auth = {
        userId: claims.sub,
        tenantId: claims.tid,
        isSuperAdmin: claims.sa,
        perms: claims.perms,
        claims,
      };
    } catch {
      auth = null;
    }
  }
  return next({ context: { auth } });
});
