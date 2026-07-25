/**
 * Best-effort audit trail. Records who changed what, when — the accountability
 * record a school ERP needs (grade edits, fee payments, deletions).
 *
 * Writes are best-effort: an audit failure is logged but never propagated, so
 * it can't break the operation being audited. The hardcoded platform admin has
 * no `users` row, so its id is stored as NULL to respect the FK.
 */
const PLATFORM_ADMIN_ID = "00000000-0000-0000-0000-000000000001";

export interface AuditEntry {
  tenantId: string | null;
  userId: string | null;
  action: string; // e.g. "marks.update", "student.delete", "fee.payment"
  entity?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const { getDb } = await import("@/db/client.server");
    const { auditLog } = await import("@/db/schema");
    const db = getDb();
    await db.insert(auditLog).values({
      tenantId: entry.tenantId,
      userId: entry.userId === PLATFORM_ADMIN_ID ? null : entry.userId,
      action: entry.action,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
    });
  } catch (e) {
    console.error("[audit] failed to record", entry.action, (e as Error).message);
  }
}
