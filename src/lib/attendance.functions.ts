/**
 * Attendance — student & employee. Tenant scoped.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, sql, asc, inArray, gte, lte } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

const status = z.enum(["present", "absent", "late", "excused"]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required");

/* ============= STUDENT ATTENDANCE ============= */

/** Roster + existing marks for a given section and date. */
export const getStudentAttendance = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "attendance.read" })])
  .inputValidator((d: unknown) =>
    z.object({ sectionId: z.string().uuid(), date: dateStr }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, studentAttendance } = await import("@/db/schema");
    const db = getDb();

    const roster = await db
      .select({
        id: students.id,
        admissionNo: students.admissionNo,
        rollNo: students.rollNo,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(students)
      .where(
        and(
          eq(students.tenantId, tid),
          eq(students.sectionId, data.sectionId),
          eq(students.isActive, true),
        ),
      )
      .orderBy(asc(students.rollNo), asc(students.firstName));

    const ids = roster.map((r) => r.id);
    const marks =
      ids.length === 0
        ? []
        : await db
            .select({
              studentId: studentAttendance.studentId,
              status: studentAttendance.status,
              note: studentAttendance.note,
            })
            .from(studentAttendance)
            .where(
              and(
                eq(studentAttendance.tenantId, tid),
                eq(studentAttendance.date, data.date),
                inArray(studentAttendance.studentId, ids),
              ),
            );
    const map = new Map(marks.map((m) => [m.studentId, m]));
    return roster.map((r) => ({
      ...r,
      status: (map.get(r.id)?.status ?? null) as
        | "present"
        | "absent"
        | "late"
        | "excused"
        | null,
      note: map.get(r.id)?.note ?? null,
    }));
  });

const markInput = z.object({
  sectionId: z.string().uuid(),
  date: dateStr,
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: status,
        note: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

export const markStudentAttendance = createServerFn({ method: "POST" })
  .middleware([requireAccess({ anyPerm: ["attendance.create", "attendance.update", "attendance.delete"] })])
  .inputValidator((d: unknown) => markInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { studentAttendance } = await import("@/db/schema");
    const db = getDb();
    const userId = context.userId;
    const values = data.entries.map((e) => ({
      tenantId: tid,
      sectionId: data.sectionId,
      studentId: e.studentId,
      date: data.date,
      status: e.status,
      note: e.note ?? null,
      markedById: userId,
      updatedAt: new Date(),
    }));
    await db
      .insert(studentAttendance)
      .values(values)
      .onConflictDoUpdate({
        target: [studentAttendance.studentId, studentAttendance.date],
        set: {
          status: sql`excluded.status`,
          note: sql`excluded.note`,
          markedById: sql`excluded.marked_by_id`,
          updatedAt: new Date(),
        },
      });
    return { ok: true, count: values.length };
  });

/** Monthly summary: per-student totals for a section within [start,end]. */
export const monthlyStudentReport = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "attendance.read" })])
  .inputValidator((d: unknown) =>
    z
      .object({
        sectionId: z.string().uuid(),
        start: dateStr,
        end: dateStr,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, studentAttendance } = await import("@/db/schema");
    const db = getDb();
    const roster = await db
      .select({
        id: students.id,
        admissionNo: students.admissionNo,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(students)
      .where(
        and(
          eq(students.tenantId, tid),
          eq(students.sectionId, data.sectionId),
          eq(students.isActive, true),
        ),
      )
      .orderBy(asc(students.firstName));
    const ids = roster.map((r) => r.id);
    if (ids.length === 0) return [];
    const rows = await db
      .select({
        studentId: studentAttendance.studentId,
        status: studentAttendance.status,
        n: sql<number>`count(*)::int`,
      })
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.tenantId, tid),
          inArray(studentAttendance.studentId, ids),
          gte(studentAttendance.date, data.start),
          lte(studentAttendance.date, data.end),
        ),
      )
      .groupBy(studentAttendance.studentId, studentAttendance.status);
    const agg = new Map<
      string,
      { present: number; absent: number; late: number; excused: number }
    >();
    for (const r of roster)
      agg.set(r.id, { present: 0, absent: 0, late: 0, excused: 0 });
    for (const row of rows) {
      const a = agg.get(row.studentId)!;
      a[row.status as "present" | "absent" | "late" | "excused"] = row.n;
    }
    return roster.map((r) => ({ ...r, ...agg.get(r.id)! }));
  });

/* ============= EMPLOYEE ATTENDANCE ============= */

export const getEmployeeAttendance = createServerFn({ method: "GET" })
  .middleware([requireAccess({ perm: "attendance.read" })])
  .inputValidator((d: unknown) => z.object({ date: dateStr }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { teachers, employeeAttendance } = await import("@/db/schema");
    const db = getDb();
    const roster = await db
      .select({
        id: teachers.id,
        employeeCode: teachers.employeeCode,
        firstName: teachers.firstName,
        lastName: teachers.lastName,
      })
      .from(teachers)
      .where(and(eq(teachers.tenantId, tid), eq(teachers.isActive, true)))
      .orderBy(asc(teachers.firstName));
    const ids = roster.map((r) => r.id);
    const marks =
      ids.length === 0
        ? []
        : await db
            .select({
              teacherId: employeeAttendance.teacherId,
              status: employeeAttendance.status,
              checkIn: employeeAttendance.checkIn,
              checkOut: employeeAttendance.checkOut,
              note: employeeAttendance.note,
            })
            .from(employeeAttendance)
            .where(
              and(
                eq(employeeAttendance.tenantId, tid),
                eq(employeeAttendance.date, data.date),
                inArray(employeeAttendance.teacherId, ids),
              ),
            );
    const map = new Map(marks.map((m) => [m.teacherId, m]));
    return roster.map((r) => ({
      ...r,
      status: (map.get(r.id)?.status ?? null) as
        | "present"
        | "absent"
        | "late"
        | "excused"
        | null,
      checkIn: map.get(r.id)?.checkIn ?? null,
      checkOut: map.get(r.id)?.checkOut ?? null,
      note: map.get(r.id)?.note ?? null,
    }));
  });

const markEmpInput = z.object({
  date: dateStr,
  entries: z
    .array(
      z.object({
        teacherId: z.string().uuid(),
        status: status,
        checkIn: z.string().optional().nullable(),
        checkOut: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

export const markEmployeeAttendance = createServerFn({ method: "POST" })
  .middleware([requireAccess({ anyPerm: ["attendance.create", "attendance.update", "attendance.delete"] })])
  .inputValidator((d: unknown) => markEmpInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { employeeAttendance } = await import("@/db/schema");
    const db = getDb();
    const userId = context.userId;
    const values = data.entries.map((e) => ({
      tenantId: tid,
      teacherId: e.teacherId,
      date: data.date,
      status: e.status,
      checkIn: e.checkIn ?? null,
      checkOut: e.checkOut ?? null,
      note: e.note ?? null,
      markedById: userId,
      updatedAt: new Date(),
    }));
    await db
      .insert(employeeAttendance)
      .values(values)
      .onConflictDoUpdate({
        target: [employeeAttendance.teacherId, employeeAttendance.date],
        set: {
          status: sql`excluded.status`,
          checkIn: sql`excluded.check_in`,
          checkOut: sql`excluded.check_out`,
          note: sql`excluded.note`,
          markedById: sql`excluded.marked_by_id`,
          updatedAt: new Date(),
        },
      });
    return { ok: true, count: values.length };
  });
