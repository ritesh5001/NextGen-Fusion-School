/**
 * Institute settings (per-tenant single row).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const getInstituteSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { instituteSettings, tenants } = await import("@/db/schema");
    const db = getDb();
    const s = (
      await db
        .select()
        .from(instituteSettings)
        .where(eq(instituteSettings.tenantId, tid))
        .limit(1)
    )[0];
    const t = (
      await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1)
    )[0];
    return { settings: s ?? null, tenant: t ?? null };
  });

const saveInput = z.object({
  name: z.string().min(2),
  motto: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  website: z.string().url().optional().or(z.literal("")).nullable(),
  timezone: z.string().default("Asia/Kolkata"),
  currency: z.string().default("INR"),
  currencySymbol: z.string().default("₹"),
  primaryColor: z.string().optional().nullable(),
});

export const saveInstituteSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => saveInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { instituteSettings, tenants } = await import("@/db/schema");
    const db = getDb();

    await db
      .update(tenants)
      .set({
        name: data.name,
        primaryColor: data.primaryColor ?? null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tid));

    const emptyToNull = (v: string | null | undefined) =>
      v && v.length > 0 ? v : null;

    const payload = {
      tenantId: tid,
      address: emptyToNull(data.address),
      phone: emptyToNull(data.phone),
      email: emptyToNull(data.email),
      website: emptyToNull(data.website),
      motto: emptyToNull(data.motto),
      timezone: data.timezone,
      currency: data.currency,
      currencySymbol: data.currencySymbol,
      updatedAt: new Date(),
    };

    await db
      .insert(instituteSettings)
      .values(payload)
      .onConflictDoUpdate({
        target: instituteSettings.tenantId,
        set: {
          address: payload.address,
          phone: payload.phone,
          email: payload.email,
          website: payload.website,
          motto: payload.motto,
          timezone: payload.timezone,
          currency: payload.currency,
          currencySymbol: payload.currencySymbol,
          updatedAt: new Date(),
        },
      });
    return { ok: true };
  });
