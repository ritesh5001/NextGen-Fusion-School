/**
 * Institute settings (per-tenant single row) — Phase 10 expanded with
 * SMTP and report/marksheet branding.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
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
    // Redact SMTP password on read
    const settings = s
      ? { ...s, smtpPassword: s.smtpPassword ? "••••••••" : null }
      : null;
    return { settings, tenant: t ?? null };
  });

const generalInput = z.object({
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
  .inputValidator((d: unknown) => generalInput.parse(d))
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

/* ============ SMTP settings ============ */
const smtpInput = z.object({
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUsername: z.string().optional().nullable(),
  smtpPassword: z.string().optional().nullable(),
  smtpFromEmail: z.string().email().optional().or(z.literal("")).nullable(),
  smtpFromName: z.string().optional().nullable(),
  smtpSecure: z.boolean().default(true),
});

export const saveSmtpSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => smtpInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { instituteSettings } = await import("@/db/schema");
    const db = getDb();
    const emptyToNull = (v: string | null | undefined) =>
      v && v.length > 0 ? v : null;

    // Ignore masked password
    const password =
      data.smtpPassword && !data.smtpPassword.startsWith("••")
        ? data.smtpPassword
        : undefined;

    const base = {
      smtpHost: emptyToNull(data.smtpHost),
      smtpPort: data.smtpPort ?? null,
      smtpUsername: emptyToNull(data.smtpUsername),
      smtpFromEmail: emptyToNull(data.smtpFromEmail),
      smtpFromName: emptyToNull(data.smtpFromName),
      smtpSecure: data.smtpSecure,
      updatedAt: new Date(),
    };

    await db
      .insert(instituteSettings)
      .values({
        tenantId: tid,
        ...base,
        ...(password !== undefined ? { smtpPassword: password } : {}),
      })
      .onConflictDoUpdate({
        target: instituteSettings.tenantId,
        set: {
          ...base,
          ...(password !== undefined ? { smtpPassword: password } : {}),
        },
      });
    return { ok: true };
  });

/* ============ Report / marksheet branding ============ */
const reportInput = z.object({
  reportHeader: z.string().optional().nullable(),
  reportFooter: z.string().optional().nullable(),
  reportLogoUrl: z.string().optional().nullable(),
  reportSignatureUrl: z.string().optional().nullable(),
  reportPrincipalName: z.string().optional().nullable(),
});

export const saveReportSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => reportInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { instituteSettings } = await import("@/db/schema");
    const db = getDb();
    const emptyToNull = (v: string | null | undefined) =>
      v && v.length > 0 ? v : null;

    const payload = {
      reportHeader: emptyToNull(data.reportHeader),
      reportFooter: emptyToNull(data.reportFooter),
      reportLogoUrl: emptyToNull(data.reportLogoUrl),
      reportSignatureUrl: emptyToNull(data.reportSignatureUrl),
      reportPrincipalName: emptyToNull(data.reportPrincipalName),
      updatedAt: new Date(),
    };

    await db
      .insert(instituteSettings)
      .values({ tenantId: tid, ...payload })
      .onConflictDoUpdate({
        target: instituteSettings.tenantId,
        set: payload,
      });
    return { ok: true };
  });
