/**
 * Simple audit-log-backed IP rate limiting for PUBLIC endpoints (contact form,
 * newsletter, admissions). Not a substitute for a CAPTCHA / WAF at real scale,
 * but stops trivial spam and abusive loops.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

export function clientIp(): string {
  return (
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestHeader("x-real-ip") ||
    "unknown"
  );
}

/** Throw 429 if this IP has done `action` more than `max` times in `windowMs`. */
export async function enforceIpRateLimit(opts: {
  action: string;
  ip: string;
  max: number;
  windowMs: number;
}): Promise<void> {
  const { getDb } = await import("@/db/client.server");
  const { auditLog } = await import("@/db/schema");
  const { and, eq, gt, sql } = await import("drizzle-orm");
  const db = getDb();
  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, opts.action),
        eq(auditLog.entityId, opts.ip),
        gt(auditLog.createdAt, new Date(Date.now() - opts.windowMs)),
      ),
    );
  if ((recent[0]?.n ?? 0) >= opts.max) {
    throw new Response("Too many requests. Please try again later.", {
      status: 429,
    });
  }
}

/** Record one rate-limited event for this IP. */
export async function recordIpEvent(opts: {
  tenantId: string | null;
  action: string;
  ip: string;
}): Promise<void> {
  const { getDb } = await import("@/db/client.server");
  const { auditLog } = await import("@/db/schema");
  const db = getDb();
  await db.insert(auditLog).values({
    tenantId: opts.tenantId,
    action: opts.action,
    entity: "public",
    entityId: opts.ip,
  });
}
