/**
 * Students CRUD, scoped to tenant.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, ilike, or, sql, desc } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

const listInput = z.object({
  query: z.string().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(5000).default(25),
});

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "students.read" })])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, classes, sections } = await import("@/db/schema");
    const db = getDb();

    const conds = [eq(students.tenantId, tid)];
    if (data.classId) conds.push(eq(students.classId, data.classId));
    if (data.sectionId) conds.push(eq(students.sectionId, data.sectionId));
    if (data.query) {
      const q = `%${data.query}%`;
      conds.push(
        or(
          ilike(students.firstName, q),
          ilike(students.lastName, q),
          ilike(students.admissionNo, q),
          ilike(students.guardianPhone, q),
        )!,
      );
    }
    const where = and(...conds);

    const totalRow = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(students)
      .where(where);
    const total = totalRow[0]?.n ?? 0;

    const rows = await db
      .select({
        id: students.id,
        admissionNo: students.admissionNo,
        rollNo: students.rollNo,
        firstName: students.firstName,
        lastName: students.lastName,
        gender: students.gender,
        photoUrl: students.photoUrl,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        classId: students.classId,
        sectionId: students.sectionId,
        className: classes.name,
        sectionName: sections.name,
        isActive: students.isActive,
        createdAt: students.createdAt,
      })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .leftJoin(sections, eq(students.sectionId, sections.id))
      .where(where)
      .orderBy(desc(students.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);

    return { total, rows, page: data.page, pageSize: data.pageSize };
  });

const upsertStudentInput = z.object({
  id: z.string().uuid().optional(),
  admissionNo: z.string().min(1).max(60),
  rollNo: z.string().optional().nullable(),
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  guardianName: z.string().optional().nullable(),
  guardianPhone: z.string().optional().nullable(),
  guardianEmail: z.string().email().optional().or(z.literal("")).nullable(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
});

export const saveStudent = createServerFn({ method: "POST" })
  .middleware([requireAccess({ anyPerm: ["students.create", "students.update", "students.delete"] })])
  .inputValidator((d: unknown) => upsertStudentInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students } = await import("@/db/schema");
    const db = getDb();

    const payload = {
      tenantId: tid,
      admissionNo: data.admissionNo.trim(),
      rollNo: data.rollNo ?? null,
      firstName: data.firstName.trim(),
      lastName: data.lastName ?? null,
      gender: data.gender ?? null,
      photoUrl: data.photoUrl && data.photoUrl.length > 0 ? data.photoUrl : null,
      dob: data.dob ? new Date(data.dob) : null,
      phone: data.phone ?? null,
      email: data.email && data.email.length > 0 ? data.email : null,
      address: data.address ?? null,
      guardianName: data.guardianName ?? null,
      guardianPhone: data.guardianPhone ?? null,
      guardianEmail:
        data.guardianEmail && data.guardianEmail.length > 0
          ? data.guardianEmail
          : null,
      classId: data.classId ?? null,
      sectionId: data.sectionId ?? null,
      academicYearId: data.academicYearId ?? null,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db
        .update(students)
        .set(payload)
        .where(and(eq(students.id, data.id), eq(students.tenantId, tid)));
      return { ok: true, id: data.id };
    }

    // Enforce the per-plan active-student cap on new admissions. During the
    // 14-day trial the effective plan is Max, so the cap is unlimited.
    const { readEntitlement } = await import("./entitlements.server");
    const ent = await readEntitlement(tid);

    if (ent.studentCap != null) {
      const cap = ent.studentCap;
      // Serialize count-then-insert per tenant with a transaction-scoped
      // advisory lock so concurrent admissions can't both slip past the cap.
      const created = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tid}))`);
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(students)
          .where(and(eq(students.tenantId, tid), eq(students.isActive, true)));
        if (n >= cap) {
          throw new Response(
            `Your ${ent.effectivePlan.toUpperCase()} plan is limited to ${cap} students. Upgrade to add more.`,
            { status: 403 },
          );
        }
        const [r] = await tx.insert(students).values(payload).returning();
        return r;
      });
      return { ok: true, id: created.id };
    }

    const [row] = await db.insert(students).values(payload).returning();
    return { ok: true, id: row.id };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireAccess({ anyPerm: ["students.create", "students.update", "students.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(students)
      .where(and(eq(students.id, data.id), eq(students.tenantId, tid)));
    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      tenantId: tid,
      userId: context.userId,
      action: "student.delete",
      entity: "student",
      entityId: data.id,
    });
    return { ok: true };
  });

export const getStudent = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "students.read" })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students } = await import("@/db/schema");
    const db = getDb();
    const row = (
      await db
        .select()
        .from(students)
        .where(and(eq(students.id, data.id), eq(students.tenantId, tid)))
        .limit(1)
    )[0];
    if (!row) throw new Response("Not found", { status: 404 });
    return row;
  });

/** Full 360° profile for one student: bio + attendance + results + fees. */
export const getStudentProfile = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "students.read" })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, classes, sections, studentAttendance, marks, examSubjects, exams, subjects, feeInvoices } =
      await import("@/db/schema");
    const { and: A, eq: E, sql: S, desc: D } = await import("drizzle-orm");
    const db = getDb();

    const [student] = await db
      .select({
        id: students.id, admissionNo: students.admissionNo, rollNo: students.rollNo,
        firstName: students.firstName, lastName: students.lastName, gender: students.gender,
        dob: students.dob, phone: students.phone, email: students.email, address: students.address,
        photoUrl: students.photoUrl, guardianName: students.guardianName, guardianPhone: students.guardianPhone,
        guardianEmail: students.guardianEmail, isActive: students.isActive,
        className: classes.name, sectionName: sections.name,
      })
      .from(students)
      .leftJoin(classes, E(students.classId, classes.id))
      .leftJoin(sections, E(students.sectionId, sections.id))
      .where(A(E(students.id, data.id), E(students.tenantId, tid)))
      .limit(1);
    if (!student) throw new Response("Not found", { status: 404 });

    const [att] = await db
      .select({
        total: S<number>`count(*)::int`,
        present: S<number>`count(*) filter (where ${studentAttendance.status} in ('present','late'))::int`,
      })
      .from(studentAttendance)
      .where(A(E(studentAttendance.tenantId, tid), E(studentAttendance.studentId, data.id)));

    const results = await db
      .select({
        exam: exams.name, subject: subjects.name,
        obtained: marks.marksObtained, max: examSubjects.maxMarks, absent: marks.isAbsent,
      })
      .from(marks)
      .innerJoin(examSubjects, E(marks.examSubjectId, examSubjects.id))
      .innerJoin(exams, E(examSubjects.examId, exams.id))
      .innerJoin(subjects, E(examSubjects.subjectId, subjects.id))
      .where(A(E(marks.tenantId, tid), E(marks.studentId, data.id)))
      .orderBy(D(exams.startsOn))
      .limit(30);

    const [fee] = await db
      .select({
        billed: S<number>`coalesce(sum(${feeInvoices.totalAmount}),0)::int`,
        paid: S<number>`coalesce(sum(${feeInvoices.paidAmount}),0)::int`,
        invoices: S<number>`count(*)::int`,
      })
      .from(feeInvoices)
      .where(A(E(feeInvoices.tenantId, tid), E(feeInvoices.studentId, data.id)));

    return {
      student,
      attendance: {
        total: att?.total ?? 0,
        present: att?.present ?? 0,
        pct: att && att.total > 0 ? Math.round((att.present / att.total) * 1000) / 10 : null,
      },
      results: results.map((r) => ({
        exam: r.exam, subject: r.subject,
        obtained: r.obtained, max: r.max, absent: r.absent,
        pct: !r.absent && r.obtained != null && r.max ? Math.round((r.obtained / r.max) * 1000) / 10 : null,
      })),
      fees: {
        billed: fee?.billed ?? 0,
        paid: fee?.paid ?? 0,
        outstanding: Math.max(0, (fee?.billed ?? 0) - (fee?.paid ?? 0)),
        invoices: fee?.invoices ?? 0,
      },
    };
  });

/** Active-student count vs the plan cap — powers the usage meter / upsell. */
export const getStudentUsage = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "students.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { readEntitlement, countActiveStudents } = await import(
      "./entitlements.server"
    );
    const ent = await readEntitlement(tid);
    const count = await countActiveStudents(tid);
    return {
      count,
      cap: ent.studentCap,
      plan: ent.effectivePlan,
      licensedPlan: ent.licensedPlan,
      trialActive: ent.trialActive,
    };
  });
