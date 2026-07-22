/**
 * Email server functions — status + send test.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const getMailStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return {
      provider: "resend" as const,
      configured: Boolean(process.env.RESEND_API_KEY),
    };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ to: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { sendMail } = await import("./mailer.server");
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const [t] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
    const name = t?.name ?? "NextGen Fusion School";
    const res = await sendMail({
      tenantId: tid,
      to: data.to,
      subject: `Test email from ${name}`,
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;padding:24px">
        <h2 style="margin:0 0 12px">Email delivery works ✓</h2>
        <p>This is a test message sent from <strong>${name}</strong> via Resend.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          Powered by NextGen Fusion School ERP
        </p>
      </div>`,
    });
    if (!res.ok) {
      throw new Response(res.error ?? "Failed to send", { status: 500 });
    }
    return { ok: true, id: res.id };
  });
