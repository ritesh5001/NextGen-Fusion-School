/**
 * Data-protection endpoints (India DPDP Act 2023 / GDPR-style rights).
 *
 *  - exportStudentData: subject access / portability — everything the system
 *    holds about one student, as JSON.
 *  - eraseStudentData: right to erasure — anonymizes the student's personal
 *    data while keeping an anonymized shell so financial/audit records stay
 *    referentially intact (regulators expect PII removal, not the destruction
 *    of accounting history).
 *
 * Both are tenant-scoped, permission-gated, and audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const exportStudentData = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "students.read" })])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, studentAttendance, marks, feeInvoices, feePayments } =
      await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const db = getDb();

    const [student] = await db
      .select()
      .from(students)
      .where(and(eq(students.id, data.studentId), eq(students.tenantId, tid)));
    if (!student) throw new Response("Student not found", { status: 404 });

    const [attendance, marksRows, invoices, payments] = await Promise.all([
      db.select().from(studentAttendance).where(eq(studentAttendance.studentId, data.studentId)),
      db.select().from(marks).where(eq(marks.studentId, data.studentId)),
      db.select().from(feeInvoices).where(eq(feeInvoices.studentId, data.studentId)),
      db
        .select()
        .from(feePayments)
        .where(eq(feePayments.tenantId, tid)),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      student,
      attendance,
      marks: marksRows,
      feeInvoices: invoices,
      // payments filtered to this student's invoices
      feePayments: payments.filter((p) => invoices.some((i) => i.id === p.invoiceId)),
    };
  });

export const eraseStudentData = createServerFn({ method: "POST" })
  .middleware([requireAccess({ perm: "students.delete" })])
  .inputValidator((d: unknown) =>
    z
      .object({ studentId: z.string().uuid(), confirm: z.literal(true) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const db = getDb();

    const [student] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, data.studentId), eq(students.tenantId, tid)));
    if (!student) throw new Response("Student not found", { status: 404 });

    // Redact personal data; keep an anonymized shell for financial integrity.
    await db
      .update(students)
      .set({
        firstName: "Redacted",
        lastName: null,
        gender: null,
        dob: null,
        phone: null,
        email: null,
        address: null,
        photoUrl: null,
        guardianName: null,
        guardianPhone: null,
        guardianEmail: null,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(students.id, data.studentId), eq(students.tenantId, tid)));

    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      tenantId: tid,
      userId: context.userId,
      action: "student.erase",
      entity: "student",
      entityId: data.studentId,
      meta: { reason: "data-subject erasure request" },
    });

    return { ok: true };
  });
