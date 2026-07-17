/**
 * Server-fn middleware: attaches the authenticated user to `context`.
 *
 * Requires a client-side `functionMiddleware` (in src/start.ts) that puts the
 * access token into the `Authorization: Bearer <jwt>` header.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { verifyAccessToken, type AccessClaims } from "./auth-core.server";

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
