/**
 * Analytics — deeper aggregate queries for the Analytics dashboards.
 * Distinct from reports.functions.ts (which returns flat counts): these return
 * shaped series/distributions intended for charts.
 *
 * Gated on `reports.read` (admins + principal) at the Pro tier.
 */
import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ============================ ACADEMIC ============================ */

export const getAcademicAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "reports.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const {
      marks,
      examSubjects,
      exams,
      subjects,
      classes,
      students,
    } = await import("@/db/schema");
    const db = getDb();

    // Percentage per mark row = marks_obtained / max_marks * 100 (exclude absentees).
    const pct = sql<number>`(${marks.marksObtained}::float / NULLIF(${examSubjects.maxMarks}, 0) * 100)`;
    const isScored = and(
      eq(marks.tenantId, tid),
      eq(marks.isAbsent, false),
      sql`${marks.marksObtained} IS NOT NULL`,
    );

    // 1. Overall KPIs: average %, pass rate (>=35%), total assessments, absent rate.
    const [kpi] = await db
      .select({
        avgPercent: sql<number>`ROUND(AVG(${pct})::numeric, 1)`,
        passRate: sql<number>`ROUND((COUNT(*) FILTER (WHERE ${pct} >= 35)::float / NULLIF(COUNT(*),0) * 100)::numeric, 1)`,
        assessments: sql<number>`COUNT(*)::int`,
        topScore: sql<number>`ROUND(MAX(${pct})::numeric, 1)`,
      })
      .from(marks)
      .innerJoin(examSubjects, eq(marks.examSubjectId, examSubjects.id))
      .where(isScored);

    const [absentAgg] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        absent: sql<number>`COUNT(*) FILTER (WHERE ${marks.isAbsent})::int`,
      })
      .from(marks)
      .where(eq(marks.tenantId, tid));

    // 2. Grade distribution (bucketed by percentage band).
    const gradeBand = sql<string>`
      CASE
        WHEN ${pct} >= 90 THEN 'A+'
        WHEN ${pct} >= 80 THEN 'A'
        WHEN ${pct} >= 70 THEN 'B+'
        WHEN ${pct} >= 60 THEN 'B'
        WHEN ${pct} >= 50 THEN 'C'
        WHEN ${pct} >= 35 THEN 'D'
        ELSE 'F'
      END`;
    const gradeDistribution = await db
      .select({
        grade: gradeBand,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(marks)
      .innerJoin(examSubjects, eq(marks.examSubjectId, examSubjects.id))
      .where(isScored)
      .groupBy(gradeBand);

    // 3. Subject-wise average %.
    const subjectAverages = await db
      .select({
        subject: subjects.name,
        avgPercent: sql<number>`ROUND(AVG(${pct})::numeric, 1)`,
        passRate: sql<number>`ROUND((COUNT(*) FILTER (WHERE ${pct} >= 35)::float / NULLIF(COUNT(*),0) * 100)::numeric, 1)`,
      })
      .from(marks)
      .innerJoin(examSubjects, eq(marks.examSubjectId, examSubjects.id))
      .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
      .where(isScored)
      .groupBy(subjects.name)
      .orderBy(sql`AVG(${pct}) DESC`);

    // 4. Class-wise comparison (average %).
    const classComparison = await db
      .select({
        className: classes.name,
        grade: classes.numericGrade,
        avgPercent: sql<number>`ROUND(AVG(${pct})::numeric, 1)`,
      })
      .from(marks)
      .innerJoin(examSubjects, eq(marks.examSubjectId, examSubjects.id))
      .innerJoin(classes, eq(examSubjects.classId, classes.id))
      .where(isScored)
      .groupBy(classes.name, classes.numericGrade)
      .orderBy(classes.numericGrade);

    // 5. Exam-over-exam trend (average % per exam, ordered by start date).
    const examTrend = await db
      .select({
        exam: exams.name,
        term: exams.term,
        startsOn: exams.startsOn,
        avgPercent: sql<number>`ROUND(AVG(${pct})::numeric, 1)`,
      })
      .from(marks)
      .innerJoin(examSubjects, eq(marks.examSubjectId, examSubjects.id))
      .innerJoin(exams, eq(examSubjects.examId, exams.id))
      .where(isScored)
      .groupBy(exams.name, exams.term, exams.startsOn)
      .orderBy(exams.startsOn);

    // 6. Top performers (by average % across all their scored assessments).
    const topPerformers = await db
      .select({
        studentId: students.id,
        name: sql<string>`${students.firstName} || ' ' || COALESCE(${students.lastName}, '')`,
        rollNo: students.rollNo,
        className: classes.name,
        avgPercent: sql<number>`ROUND(AVG(${pct})::numeric, 1)`,
        subjects: sql<number>`COUNT(*)::int`,
      })
      .from(marks)
      .innerJoin(examSubjects, eq(marks.examSubjectId, examSubjects.id))
      .innerJoin(students, eq(marks.studentId, students.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(isScored)
      .groupBy(students.id, students.firstName, students.lastName, students.rollNo, classes.name)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(sql`AVG(${pct}) DESC`)
      .limit(10);

    return {
      kpi: {
        avgPercent: Number(kpi?.avgPercent ?? 0),
        passRate: Number(kpi?.passRate ?? 0),
        assessments: kpi?.assessments ?? 0,
        topScore: Number(kpi?.topScore ?? 0),
        absentRate:
          absentAgg && absentAgg.total > 0
            ? Math.round((absentAgg.absent / absentAgg.total) * 1000) / 10
            : 0,
      },
      gradeDistribution: gradeDistribution.map((g) => ({
        grade: g.grade,
        count: g.count,
      })),
      subjectAverages: subjectAverages.map((s) => ({
        subject: s.subject,
        avgPercent: Number(s.avgPercent ?? 0),
        passRate: Number(s.passRate ?? 0),
      })),
      classComparison: classComparison.map((c) => ({
        className: c.className,
        avgPercent: Number(c.avgPercent ?? 0),
      })),
      examTrend: examTrend.map((e) => ({
        exam: e.exam,
        avgPercent: Number(e.avgPercent ?? 0),
      })),
      topPerformers: topPerformers.map((t) => ({
        name: t.name.trim(),
        rollNo: t.rollNo,
        className: t.className,
        avgPercent: Number(t.avgPercent ?? 0),
      })),
    };
  });

/* ============================ ATTENDANCE ============================ */

export const getAttendanceAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "reports.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { studentAttendance, sections, classes, students } = await import("@/db/schema");
    const db = getDb();

    const present = sql<number>`COUNT(*) FILTER (WHERE ${studentAttendance.status} = 'present')`;
    const total = sql<number>`COUNT(*)`;

    // 1. KPIs: overall present %, and status breakdown.
    const [kpi] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        present: sql<number>`COUNT(*) FILTER (WHERE ${studentAttendance.status} = 'present')::int`,
        absent: sql<number>`COUNT(*) FILTER (WHERE ${studentAttendance.status} = 'absent')::int`,
        late: sql<number>`COUNT(*) FILTER (WHERE ${studentAttendance.status} = 'late')::int`,
        excused: sql<number>`COUNT(*) FILTER (WHERE ${studentAttendance.status} = 'excused')::int`,
        days: sql<number>`COUNT(DISTINCT ${studentAttendance.date})::int`,
      })
      .from(studentAttendance)
      .where(eq(studentAttendance.tenantId, tid));

    // 2. Daily trend — present % per date (last 30 recorded days).
    const dailyTrend = await db
      .select({
        date: studentAttendance.date,
        pct: sql<number>`ROUND((${present}::float / NULLIF(${total},0) * 100)::numeric, 1)`,
      })
      .from(studentAttendance)
      .where(eq(studentAttendance.tenantId, tid))
      .groupBy(studentAttendance.date)
      .orderBy(studentAttendance.date);

    // 3. Per-class present %.
    const byClass = await db
      .select({
        className: classes.name,
        grade: classes.numericGrade,
        pct: sql<number>`ROUND((${present}::float / NULLIF(${total},0) * 100)::numeric, 1)`,
      })
      .from(studentAttendance)
      .innerJoin(sections, eq(studentAttendance.sectionId, sections.id))
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(eq(studentAttendance.tenantId, tid))
      .groupBy(classes.name, classes.numericGrade)
      .orderBy(classes.numericGrade);

    // 4. Chronic absentees — students with the lowest present % (min 3 records).
    const chronicAbsentees = await db
      .select({
        name: sql<string>`${students.firstName} || ' ' || COALESCE(${students.lastName}, '')`,
        rollNo: students.rollNo,
        className: classes.name,
        days: sql<number>`COUNT(*)::int`,
        absentDays: sql<number>`COUNT(*) FILTER (WHERE ${studentAttendance.status} IN ('absent','late'))::int`,
        presentPct: sql<number>`ROUND((${present}::float / NULLIF(${total},0) * 100)::numeric, 1)`,
      })
      .from(studentAttendance)
      .innerJoin(students, eq(studentAttendance.studentId, students.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(studentAttendance.tenantId, tid))
      .groupBy(students.firstName, students.lastName, students.rollNo, classes.name)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(sql`(${present}::float / NULLIF(${total},0))`)
      .limit(10);

    return {
      kpi: {
        presentPct: kpi && kpi.total > 0 ? Math.round((kpi.present / kpi.total) * 1000) / 10 : 0,
        total: kpi?.total ?? 0,
        days: kpi?.days ?? 0,
        breakdown: [
          { status: "Present", count: kpi?.present ?? 0 },
          { status: "Absent", count: kpi?.absent ?? 0 },
          { status: "Late", count: kpi?.late ?? 0 },
          { status: "Excused", count: kpi?.excused ?? 0 },
        ],
      },
      dailyTrend: dailyTrend.map((d) => ({
        date: d.date.slice(5), // MM-DD
        pct: Number(d.pct ?? 0),
      })),
      byClass: byClass.map((c) => ({ className: c.className, pct: Number(c.pct ?? 0) })),
      chronicAbsentees: chronicAbsentees
        .filter((c) => Number(c.presentPct) < 100)
        .map((c) => ({
          name: c.name.trim(),
          rollNo: c.rollNo,
          className: c.className,
          absentDays: c.absentDays,
          days: c.days,
          presentPct: Number(c.presentPct ?? 0),
        })),
    };
  });

/* ============================ FINANCE ============================ */

export const getFinanceAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "reports.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeInvoices, feePayments, feeInvoiceItems, feeHeads, students, classes } =
      await import("@/db/schema");
    const db = getDb();

    // 1. KPIs: billed, collected, outstanding, collection rate.
    const [agg] = await db
      .select({
        billed: sql<number>`COALESCE(SUM(${feeInvoices.totalAmount}),0)::int`,
        collected: sql<number>`COALESCE(SUM(${feeInvoices.paidAmount}),0)::int`,
        invoices: sql<number>`COUNT(*)::int`,
        paidCount: sql<number>`COUNT(*) FILTER (WHERE ${feeInvoices.status} = 'paid')::int`,
        unpaidCount: sql<number>`COUNT(*) FILTER (WHERE ${feeInvoices.status} = 'unpaid')::int`,
        partialCount: sql<number>`COUNT(*) FILTER (WHERE ${feeInvoices.status} = 'partial')::int`,
      })
      .from(feeInvoices)
      .where(eq(feeInvoices.tenantId, tid));

    // 2. Monthly collection (from payments, by month of paid_on).
    const monthly = await db
      .select({
        month: sql<string>`to_char(${feePayments.paidOn}::date, 'YYYY-MM')`,
        amount: sql<number>`COALESCE(SUM(${feePayments.amount}),0)::int`,
      })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tid), eq(feePayments.isCancelled, false)))
      .groupBy(sql`to_char(${feePayments.paidOn}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${feePayments.paidOn}::date, 'YYYY-MM')`);

    // 3. Collection by fee head (from invoice items).
    const byHead = await db
      .select({
        head: feeHeads.name,
        amount: sql<number>`COALESCE(SUM(${feeInvoiceItems.amount}),0)::int`,
      })
      .from(feeInvoiceItems)
      .innerJoin(feeHeads, eq(feeInvoiceItems.feeHeadId, feeHeads.id))
      .where(eq(feeInvoiceItems.tenantId, tid))
      .groupBy(feeHeads.name)
      .orderBy(sql`SUM(${feeInvoiceItems.amount}) DESC`);

    // 4. Payment method split.
    const byMethod = await db
      .select({
        method: feePayments.method,
        amount: sql<number>`COALESCE(SUM(${feePayments.amount}),0)::int`,
      })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tid), eq(feePayments.isCancelled, false)))
      .groupBy(feePayments.method)
      .orderBy(sql`SUM(${feePayments.amount}) DESC`);

    // 5. Top defaulters (highest outstanding).
    const defaulters = await db
      .select({
        name: sql<string>`${students.firstName} || ' ' || COALESCE(${students.lastName}, '')`,
        rollNo: students.rollNo,
        className: classes.name,
        outstanding: sql<number>`SUM(${feeInvoices.totalAmount} - ${feeInvoices.paidAmount})::int`,
      })
      .from(feeInvoices)
      .innerJoin(students, eq(feeInvoices.studentId, students.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(feeInvoices.tenantId, tid))
      .groupBy(students.firstName, students.lastName, students.rollNo, classes.name)
      .having(sql`SUM(${feeInvoices.totalAmount} - ${feeInvoices.paidAmount}) > 0`)
      .orderBy(sql`SUM(${feeInvoices.totalAmount} - ${feeInvoices.paidAmount}) DESC`)
      .limit(10);

    const billed = agg?.billed ?? 0;
    const collected = agg?.collected ?? 0;
    return {
      kpi: {
        billed,
        collected,
        outstanding: billed - collected,
        collectionRate: billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0,
        invoices: agg?.invoices ?? 0,
      },
      statusSplit: [
        { status: "Paid", count: agg?.paidCount ?? 0 },
        { status: "Partial", count: agg?.partialCount ?? 0 },
        { status: "Unpaid", count: agg?.unpaidCount ?? 0 },
      ],
      monthly: monthly.map((m) => ({ month: m.month, amount: m.amount })),
      byHead: byHead.map((h) => ({ head: h.head, amount: h.amount })),
      byMethod: byMethod.map((m) => ({ method: m.method, amount: m.amount })),
      defaulters: defaulters.map((d) => ({
        name: d.name.trim(),
        rollNo: d.rollNo,
        className: d.className,
        outstanding: d.outstanding,
      })),
    };
  });

/* ============================ ENROLLMENT / HR ============================ */

export const getEnrollmentAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "reports.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, teachers, employees, classes, admissionApplications } =
      await import("@/db/schema");
    const db = getDb();

    // 1. Headcount KPIs + student:teacher ratio.
    const [sCount] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${students.isActive})::int`,
        male: sql<number>`COUNT(*) FILTER (WHERE ${students.gender} = 'male')::int`,
        female: sql<number>`COUNT(*) FILTER (WHERE ${students.gender} = 'female')::int`,
        other: sql<number>`COUNT(*) FILTER (WHERE ${students.gender} = 'other')::int`,
      })
      .from(students)
      .where(eq(students.tenantId, tid));
    const [tCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(teachers)
      .where(eq(teachers.tenantId, tid));
    const [eCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(employees)
      .where(eq(employees.tenantId, tid));

    // 2. Students per class.
    const byClass = await db
      .select({
        className: classes.name,
        grade: classes.numericGrade,
        count: sql<number>`COUNT(${students.id})::int`,
      })
      .from(classes)
      .leftJoin(students, and(eq(students.classId, classes.id), eq(students.isActive, true)))
      .where(eq(classes.tenantId, tid))
      .groupBy(classes.name, classes.numericGrade)
      .orderBy(classes.numericGrade);

    // 3. Admission funnel by status.
    const funnel = await db
      .select({
        status: admissionApplications.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(admissionApplications)
      .where(eq(admissionApplications.tenantId, tid))
      .groupBy(admissionApplications.status);

    const active = sCount?.active ?? 0;
    const teacherN = tCount?.n ?? 0;
    return {
      kpi: {
        students: active,
        teachers: teacherN,
        employees: eCount?.n ?? 0,
        ratio: teacherN > 0 ? Math.round((active / teacherN) * 10) / 10 : 0,
      },
      gender: [
        { label: "Male", count: sCount?.male ?? 0 },
        { label: "Female", count: sCount?.female ?? 0 },
        { label: "Other", count: sCount?.other ?? 0 },
      ].filter((g) => g.count > 0),
      byClass: byClass.map((c) => ({ className: c.className, count: c.count })),
      funnel: funnel.map((f) => ({ status: f.status, count: f.count })),
    };
  });
