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
