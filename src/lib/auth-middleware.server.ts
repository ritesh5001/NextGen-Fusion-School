/**
 * Server-fn middleware: attaches the authenticated user to `context`.
 *
 * Requires a client-side `functionMiddleware` (in src/start.ts) that puts the
 * access token into the `Authorization: Bearer <jwt>` header.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { verifyAccessToken, type AccessClaims } from "./auth-core.server";
import { planAtLeast, PLAN_LABELS, type PlanTier } from "./plans";
import { hasPerm } from "./permissions.server";

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
  return requireAccess({ plan: minTier });
}

/**
 * Combined server-side gate for a paid, permissioned module. Chain this instead
 * of `requireAuth` on module server functions:
 *
 *   .middleware([requireAccess({ plan: "pro", perm: "exams.read" })])
 *   .middleware([requireAccess({ plan: "pro", anyPerm: ["exams.create","exams.update","exams.delete"] })])
 *
 *  - `perm`     — a single permission the caller must hold.
 *  - `anyPerm`  — caller must hold at least one of these (use for writes).
 *  - `plan`     — minimum tier; checked against the tenant's EFFECTIVE plan, so
 *                 an active 14-day trial (which grants Max) passes, and the gate
 *                 re-tightens automatically when the trial ends.
 *
 * Super admins (the vendor operator) bypass both gates. Permissions come from
 * the signed access token; the plan is read fresh so upgrades take effect at
 * once and a stale token can't reach a locked module.
 */
export function requireAccess(opts: {
  plan?: PlanTier;
  perm?: string;
  anyPerm?: string[];
}) {
  return createMiddleware()
    .middleware([requireAuth])
    .server(async ({ next, context }) => {
      if (!context.isSuperAdmin) {
        // RBAC — permission keys carried in the access token.
        if (opts.perm && !hasPerm(context.perms, opts.perm)) {
          throw new Response("Forbidden — you don't have access to this action", {
            status: 403,
          });
        }
        if (
          opts.anyPerm &&
          opts.anyPerm.length > 0 &&
          !opts.anyPerm.some((p) => hasPerm(context.perms, p))
        ) {
          throw new Response("Forbidden — you don't have access to this action", {
            status: 403,
          });
        }

        // Plan gate — trial-aware effective plan.
        if (opts.plan) {
          if (!context.tenantId) {
            throw new Response("Tenant scope required", { status: 400 });
          }
          const { readEntitlement } = await import("./entitlements.server");
          const ent = await readEntitlement(context.tenantId);
          if (!planAtLeast(ent.effectivePlan, opts.plan)) {
            throw new Response(
              `This feature requires the ${PLAN_LABELS[opts.plan]} plan. Upgrade your license to continue.`,
              { status: 403 },
            );
          }
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
