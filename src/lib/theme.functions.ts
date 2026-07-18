/**
 * Per-tenant theme server functions. Themes are stored on tenants.themeJson
 * and are scoped strictly per workspace — one school's palette change never
 * affects another.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

const themeSchema = z.object({
  preset: z.string().min(1),
  mode: z.enum(["light", "dark", "system"]),
  radius: z.number().min(0).max(1.2),
});

/** Public — read a tenant's theme by slug (for public school pages + login). */
export const getTenantThemeBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const db = getDb();
    const rows = await db
      .select({ themeJson: tenants.themeJson })
      .from(tenants)
      .where(eq(tenants.slug, data.slug))
      .limit(1);
    return { themeJson: rows[0]?.themeJson ?? null };
  });

/** Authenticated — read the current user's tenant theme. */
export const getMyTenantTheme = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.tenantId) return { themeJson: null };
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const db = getDb();
    const rows = await db
      .select({ themeJson: tenants.themeJson })
      .from(tenants)
      .where(eq(tenants.id, context.tenantId))
      .limit(1);
    return { themeJson: rows[0]?.themeJson ?? null };
  });

/** Authenticated — save theme for the current user's tenant. */
export const saveMyTenantTheme = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => themeSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.tenantId) throw new Response("Super admin has no tenant", { status: 400 });
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(tenants)
      .set({ themeJson: JSON.stringify(data), updatedAt: new Date() })
      .where(eq(tenants.id, context.tenantId));
    return { ok: true };
  });
