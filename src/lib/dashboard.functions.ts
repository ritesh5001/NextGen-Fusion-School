/**
 * Real dashboard metrics for the signed-in tenant. Replaces the old static
 * placeholder numbers on the overview page.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware.server";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.tenantId) {
      return {
        studentCount: 0,
        staffCount: 0,
        feesCollected: 0,
        attendancePct: null as number | null,
        recentAdmissions: [] as {
          id: string;
          name: string;
          status: string;
          createdAt: string | Date;
        }[],
        upcomingEvents: [] as {
          id: string;
          title: string;
          startDate: string;
          location: string | null;
        }[],
      };
    }
    const tid = context.tenantId;
    const { getDb } = await import("@/db/client.server");
    const {
      students,
      teachers,
      feePayments,
      studentAttendance,
      admissionApplications,
      calendarEvents,
    } = await import("@/db/schema");
    const { and, eq, sql, gte, desc } = await import("drizzle-orm");
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    const [studentRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(students)
      .where(and(eq(students.tenantId, tid), eq(students.isActive, true)));

    const [staffRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(teachers)
      .where(and(eq(teachers.tenantId, tid), eq(teachers.isActive, true)));

    const [feeRow] = await db
      .select({ sum: sql<number>`coalesce(sum(${feePayments.amount}),0)::int` })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tid), eq(feePayments.isCancelled, false)));

    const [attRow] = await db
      .select({
        present: sql<number>`count(*) filter (where ${studentAttendance.status} in ('present','late'))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(studentAttendance)
      .where(
        and(eq(studentAttendance.tenantId, tid), eq(studentAttendance.date, today)),
      );
    const attendancePct =
      attRow && attRow.total > 0
        ? Math.round((attRow.present / attRow.total) * 1000) / 10
        : null;

    const recentAdmissions = await db
      .select({
        id: admissionApplications.id,
        name: sql<string>`${admissionApplications.firstName} || ' ' || coalesce(${admissionApplications.lastName}, '')`,
        status: admissionApplications.status,
        createdAt: admissionApplications.submittedAt,
      })
      .from(admissionApplications)
      .where(eq(admissionApplications.tenantId, tid))
      .orderBy(desc(admissionApplications.submittedAt))
      .limit(5);

    const upcomingEvents = await db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        startDate: calendarEvents.startDate,
        location: calendarEvents.location,
      })
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.tenantId, tid), gte(calendarEvents.startDate, today)),
      )
      .orderBy(calendarEvents.startDate)
      .limit(5);

    return {
      studentCount: studentRow?.n ?? 0,
      staffCount: staffRow?.n ?? 0,
      feesCollected: feeRow?.sum ?? 0,
      attendancePct,
      recentAdmissions,
      upcomingEvents,
    };
  });
