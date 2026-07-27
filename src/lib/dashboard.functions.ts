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
        enrollmentByClass: [] as { className: string; count: number }[],
        feeSplit: { collected: 0, outstanding: 0 },
        attendanceTrend: [] as { date: string; pct: number }[],
      };
    }
    const tid = context.tenantId;
    const { getDb } = await import("@/db/client.server");
    const {
      students,
      teachers,
      feePayments,
      feeInvoices,
      classes,
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

    /* ---- Compact analytics for the dashboard widgets ---- */

    // Enrollment by class (active students).
    const enrollmentByClass = await db
      .select({
        className: classes.name,
        grade: classes.numericGrade,
        count: sql<number>`count(${students.id})::int`,
      })
      .from(classes)
      .leftJoin(
        students,
        and(eq(students.classId, classes.id), eq(students.isActive, true)),
      )
      .where(eq(classes.tenantId, tid))
      .groupBy(classes.name, classes.numericGrade)
      .orderBy(classes.numericGrade);

    // Fee collected vs outstanding (from invoices).
    const [feeSplitRow] = await db
      .select({
        billed: sql<number>`coalesce(sum(${feeInvoices.totalAmount}),0)::int`,
        collected: sql<number>`coalesce(sum(${feeInvoices.paidAmount}),0)::int`,
      })
      .from(feeInvoices)
      .where(eq(feeInvoices.tenantId, tid));

    // Attendance present% for the last 7 recorded days.
    const attendanceTrend = await db
      .select({
        date: studentAttendance.date,
        pct: sql<number>`round((count(*) filter (where ${studentAttendance.status} in ('present','late'))::float / nullif(count(*),0) * 100)::numeric, 1)`,
      })
      .from(studentAttendance)
      .where(eq(studentAttendance.tenantId, tid))
      .groupBy(studentAttendance.date)
      .orderBy(sql`${studentAttendance.date} DESC`)
      .limit(7);

    return {
      studentCount: studentRow?.n ?? 0,
      staffCount: staffRow?.n ?? 0,
      feesCollected: feeRow?.sum ?? 0,
      attendancePct,
      recentAdmissions,
      upcomingEvents,
      enrollmentByClass: enrollmentByClass.map((c) => ({
        className: c.className,
        count: c.count,
      })),
      feeSplit: {
        collected: feeSplitRow?.collected ?? 0,
        outstanding: Math.max(0, (feeSplitRow?.billed ?? 0) - (feeSplitRow?.collected ?? 0)),
      },
      attendanceTrend: attendanceTrend
        .reverse()
        .map((a) => ({ date: a.date.slice(5), pct: Number(a.pct ?? 0) })),
    };
  });
