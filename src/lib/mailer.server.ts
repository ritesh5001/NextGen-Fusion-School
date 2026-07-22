/**
 * Email delivery via Resend.
 *
 * Env: RESEND_API_KEY (only variable required)
 * From address & display name are pulled from institute_settings
 * (smtpFromEmail / smtpFromName). Falls back to tenant name +
 * `onboarding@resend.dev` for first-run / testing.
 */
import { eq } from "drizzle-orm";

export type SendMailInput = {
  tenantId: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

export type SendMailResult = {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
};

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      error:
        "RESEND_API_KEY not configured. Add it as an environment secret to enable email delivery.",
    };
  }

  const { getDb } = await import("@/db/client.server");
  const { instituteSettings, tenants } = await import("@/db/schema");
  const db = getDb();

  const [settings] = await db
    .select()
    .from(instituteSettings)
    .where(eq(instituteSettings.tenantId, input.tenantId))
    .limit(1);
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  const fromEmail =
    (settings?.smtpFromEmail && settings.smtpFromEmail.trim()) ||
    "onboarding@resend.dev";
  const fromName =
    (settings?.smtpFromName && settings.smtpFromName.trim()) ||
    tenant?.name ||
    "NextGen Fusion School";
  const from = `${fromName} <${fromEmail}>`;

  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
  };
  if (input.html) body.html = input.html;
  if (input.text) body.text = input.text;
  if (input.replyTo) body.reply_to = input.replyTo;
  if (!body.html && !body.text) body.text = input.subject;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}: ${txt}` };
    }
    let parsed: { id?: string } = {};
    try {
      parsed = JSON.parse(txt);
    } catch {
      /* ignore */
    }
    return { ok: true, id: parsed.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
