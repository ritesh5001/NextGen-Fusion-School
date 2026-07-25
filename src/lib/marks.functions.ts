/**
 * Marks entry, result generation, and public marksheet lookup.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, asc, inArray, sql } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/** Return roster + existing marks for a class/section for a given exam-subject */
export const getMarksGrid = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "marks.read" })])
  .inputValidator((d: unknown) =>
    z
      .object({
        examSubjectId: z.string().uuid(),
        sectionId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { examSubjects, students, marks, classes, subjects } = await import(
      "@/db/schema"
    );
    const db = getDb();

    const [es] = await db
      .select({
        id: examSubjects.id,
        examId: examSubjects.examId,
        classId: examSubjects.classId,
        subjectId: examSubjects.subjectId,
        maxMarks: examSubjects.maxMarks,
        passMarks: examSubjects.passMarks,
        className: classes.name,
        subjectName: subjects.name,
      })
      .from(examSubjects)
      .innerJoin(classes, eq(classes.id, examSubjects.classId))
      .innerJoin(subjects, eq(subjects.id, examSubjects.subjectId))
      .where(
        and(
          eq(examSubjects.tenantId, tid),
          eq(examSubjects.id, data.examSubjectId),
        ),
      );

    if (!es) throw new Response("Exam subject not found", { status: 404 });

    const filters = [
      eq(students.tenantId, tid),
      eq(students.classId, es.classId),
      eq(students.isActive, true),
    ];
    if (data.sectionId) filters.push(eq(students.sectionId, data.sectionId));

    const roster = await db
      .select({
        id: students.id,
        admissionNo: students.admissionNo,
        rollNo: students.rollNo,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(students)
      .where(and(...filters))
      .orderBy(asc(students.rollNo), asc(students.firstName));

    const ids = roster.map((r) => r.id);
    const existing =
      ids.length === 0
        ? []
        : await db
            .select({
              studentId: marks.studentId,
              marksObtained: marks.marksObtained,
              isAbsent: marks.isAbsent,
              remark: marks.remark,
            })
            .from(marks)
            .where(
              and(
                eq(marks.tenantId, tid),
                eq(marks.examSubjectId, data.examSubjectId),
                inArray(marks.studentId, ids),
              ),
            );
    const map = new Map(existing.map((m) => [m.studentId, m]));
    return {
      examSubject: es,
      rows: roster.map((r) => ({
        ...r,
        marksObtained: map.get(r.id)?.marksObtained ?? null,
        isAbsent: map.get(r.id)?.isAbsent ?? false,
        remark: map.get(r.id)?.remark ?? null,
      })),
    };
  });

export const saveMarks = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["marks.create", "marks.update", "marks.delete"] })])
  .inputValidator((d: unknown) =>
    z
      .object({
        examSubjectId: z.string().uuid(),
        entries: z
          .array(
            z.object({
              studentId: z.string().uuid(),
              marksObtained: z.number().int().min(0).max(1000).nullable(),
              isAbsent: z.boolean().optional(),
              remark: z.string().optional().nullable(),
            }),
          )
          .min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { marks } = await import("@/db/schema");
    const db = getDb();
    const values = data.entries.map((e) => ({
      tenantId: tid,
      examSubjectId: data.examSubjectId,
      studentId: e.studentId,
      marksObtained: e.isAbsent ? null : e.marksObtained,
      isAbsent: !!e.isAbsent,
      remark: e.remark ?? null,
      updatedAt: new Date(),
    }));
    await db
      .insert(marks)
      .values(values)
      .onConflictDoUpdate({
        target: [marks.examSubjectId, marks.studentId],
        set: {
          marksObtained: sql`excluded.marks_obtained`,
          isAbsent: sql`excluded.is_absent`,
          remark: sql`excluded.remark`,
          updatedAt: new Date(),
        },
      });
    // Grade changes are sensitive — record an audit trail.
    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      tenantId: tid,
      userId: context.userId,
      action: "marks.update",
      entity: "examSubject",
      entityId: data.examSubjectId,
      meta: { count: values.length },
    });
    return { ok: true, count: values.length };
  });

/**
 * Compute a class result: every student in the exam's class × all exam subjects.
 */
export const getExamResults = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "marks.read" })])
  .inputValidator((d: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        classId: z.string().uuid(),
        sectionId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    return computeResults(tid, data.examId, data.classId, data.sectionId ?? null);
  });

async function computeResults(
  tid: string,
  examId: string,
  classId: string,
  sectionId: string | null,
) {
  const { getDb } = await import("@/db/client.server");
  const { examSubjects, students, marks, subjects, exams, gradeScales, grades } =
    await import("@/db/schema");
  const db = getDb();

  const [exam] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.tenantId, tid), eq(exams.id, examId)));
  if (!exam) throw new Response("Exam not found", { status: 404 });

  const subs = await db
    .select({
      id: examSubjects.id,
      subjectId: examSubjects.subjectId,
      subjectName: subjects.name,
      maxMarks: examSubjects.maxMarks,
      passMarks: examSubjects.passMarks,
    })
    .from(examSubjects)
    .innerJoin(subjects, eq(subjects.id, examSubjects.subjectId))
    .where(
      and(
        eq(examSubjects.tenantId, tid),
        eq(examSubjects.examId, examId),
        eq(examSubjects.classId, classId),
      ),
    )
    .orderBy(asc(subjects.name));

  const filters = [
    eq(students.tenantId, tid),
    eq(students.classId, classId),
    eq(students.isActive, true),
  ];
  if (sectionId) filters.push(eq(students.sectionId, sectionId));

  const roster = await db
    .select({
      id: students.id,
      admissionNo: students.admissionNo,
      rollNo: students.rollNo,
      firstName: students.firstName,
      lastName: students.lastName,
    })
    .from(students)
    .where(and(...filters))
    .orderBy(asc(students.rollNo), asc(students.firstName));

  const esIds = subs.map((s) => s.id);
  const stuIds = roster.map((s) => s.id);
  const allMarks =
    esIds.length === 0 || stuIds.length === 0
      ? []
      : await db
          .select({
            examSubjectId: marks.examSubjectId,
            studentId: marks.studentId,
            marksObtained: marks.marksObtained,
            isAbsent: marks.isAbsent,
          })
          .from(marks)
          .where(
            and(
              eq(marks.tenantId, tid),
              inArray(marks.examSubjectId, esIds),
              inArray(marks.studentId, stuIds),
            ),
          );

  const key = (a: string, b: string) => `${a}:${b}`;
  const mmap = new Map(
    allMarks.map((m) => [key(m.studentId, m.examSubjectId), m]),
  );

  // Grade bands
  let bands: Array<{
    name: string;
    minPercent: number;
    maxPercent: number;
    gpa: string | null;
  }> = [];
  if (exam.gradeScaleId) {
    const rows = await db
      .select({
        name: grades.name,
        minPercent: grades.minPercent,
        maxPercent: grades.maxPercent,
        gpa: grades.gpa,
      })
      .from(grades)
      .where(
        and(eq(grades.tenantId, tid), eq(grades.scaleId, exam.gradeScaleId)),
      );
    bands = rows;
  }
  const gradeFor = (percent: number) => {
    const b = bands.find(
      (b) => percent >= b.minPercent && percent <= b.maxPercent,
    );
    return b ? { name: b.name, gpa: b.gpa } : { name: "—", gpa: null };
  };

  const totalMax = subs.reduce((n, s) => n + s.maxMarks, 0);

  const results = roster.map((stu) => {
    let totalObtained = 0;
    let anyFail = false;
    let anyAbsent = false;
    const perSubject = subs.map((s) => {
      const m = mmap.get(key(stu.id, s.id));
      const absent = m?.isAbsent ?? false;
      const obtained = absent ? 0 : m?.marksObtained ?? 0;
      const pass = !absent && obtained >= s.passMarks;
      if (absent) anyAbsent = true;
      if (!pass) anyFail = true;
      totalObtained += obtained;
      return {
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        maxMarks: s.maxMarks,
        passMarks: s.passMarks,
        marksObtained: absent ? null : m?.marksObtained ?? null,
        isAbsent: absent,
        pass,
      };
    });
    const percent =
      totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : 0;
    const grade = gradeFor(percent);
    return {
      student: stu,
      subjects: perSubject,
      totalObtained,
      totalMax,
      percent,
      grade: grade.name,
      gpa: grade.gpa,
      status: anyFail || anyAbsent ? "FAIL" : "PASS",
    };
  });

  // Add ranks (by totalObtained desc), skip students with all null
  const ranked = [...results].sort((a, b) => b.totalObtained - a.totalObtained);
  const rankMap = new Map<string, number>();
  ranked.forEach((r, i) => rankMap.set(r.student.id, i + 1));

  return {
    exam: {
      id: exam.id,
      name: exam.name,
      term: exam.term,
      startsOn: exam.startsOn,
      endsOn: exam.endsOn,
      isPublished: exam.isPublished,
    },
    subjects: subs,
    results: results.map((r) => ({ ...r, rank: rankMap.get(r.student.id)! })),
  };
}

/**
 * Public marksheet: NO auth required. Only returns data if the exam is published.
 * Tenant is derived from the student, so callers only need examId+studentId.
 */
export const getPublicMarksheet = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        studentId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const {
      exams,
      students,
      examSubjects,
      marks,
      subjects,
      classes,
      sections,
      tenants,
      grades,
      instituteSettings,
    } = await import("@/db/schema");
    const db = getDb();

    const [stu] = await db
      .select({
        id: students.id,
        tenantId: students.tenantId,
        admissionNo: students.admissionNo,
        rollNo: students.rollNo,
        firstName: students.firstName,
        lastName: students.lastName,
        classId: students.classId,
        sectionId: students.sectionId,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(students)
      .leftJoin(classes, eq(classes.id, students.classId))
      .leftJoin(sections, eq(sections.id, students.sectionId))
      .where(eq(students.id, data.studentId));
    if (!stu) throw new Response("Not found", { status: 404 });

    const [exam] = await db
      .select()
      .from(exams)
      .where(
        and(
          eq(exams.tenantId, stu.tenantId),
          eq(exams.id, data.examId),
          eq(exams.isPublished, true),
        ),
      );
    if (!exam) throw new Response("Marksheet not available", { status: 404 });

    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name, logoUrl: tenants.logoUrl })
      .from(tenants)
      .where(eq(tenants.id, stu.tenantId));

    const [settings] = await db
      .select()
      .from(instituteSettings)
      .where(eq(instituteSettings.tenantId, stu.tenantId));

    if (!stu.classId) {
      return {
        tenant,
        settings,
        exam,
        student: stu,
        subjects: [] as Array<{
          subjectName: string;
          maxMarks: number;
          passMarks: number;
          marksObtained: number | null;
          isAbsent: boolean;
          pass: boolean;
        }>,
        totalObtained: 0,
        totalMax: 0,
        percent: 0,
        grade: "—",
        gpa: null as string | null,
        status: "N/A" as "PASS" | "FAIL" | "N/A",
      };
    }

    const subs = await db
      .select({
        id: examSubjects.id,
        subjectName: subjects.name,
        maxMarks: examSubjects.maxMarks,
        passMarks: examSubjects.passMarks,
      })
      .from(examSubjects)
      .innerJoin(subjects, eq(subjects.id, examSubjects.subjectId))
      .where(
        and(
          eq(examSubjects.tenantId, stu.tenantId),
          eq(examSubjects.examId, data.examId),
          eq(examSubjects.classId, stu.classId),
        ),
      )
      .orderBy(asc(subjects.name));

    const marksRows =
      subs.length === 0
        ? []
        : await db
            .select()
            .from(marks)
            .where(
              and(
                eq(marks.tenantId, stu.tenantId),
                eq(marks.studentId, stu.id),
                inArray(
                  marks.examSubjectId,
                  subs.map((s) => s.id),
                ),
              ),
            );
    const mmap = new Map(marksRows.map((m) => [m.examSubjectId, m]));

    let totalObtained = 0;
    let totalMax = 0;
    let anyFail = false;
    const rowsOut = subs.map((s) => {
      const m = mmap.get(s.id);
      const absent = m?.isAbsent ?? false;
      const obtained = absent ? 0 : m?.marksObtained ?? 0;
      const pass = !absent && obtained >= s.passMarks;
      if (!pass) anyFail = true;
      totalObtained += obtained;
      totalMax += s.maxMarks;
      return {
        subjectName: s.subjectName,
        maxMarks: s.maxMarks,
        passMarks: s.passMarks,
        marksObtained: absent ? null : m?.marksObtained ?? null,
        isAbsent: absent,
        pass,
      };
    });
    const percent =
      totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : 0;

    let gradeName = "—";
    let gpa: string | null = null;
    if (exam.gradeScaleId) {
      const bands = await db
        .select()
        .from(grades)
        .where(
          and(
            eq(grades.tenantId, stu.tenantId),
            eq(grades.scaleId, exam.gradeScaleId),
          ),
        );
      const b = bands.find(
        (x) => percent >= x.minPercent && percent <= x.maxPercent,
      );
      if (b) {
        gradeName = b.name;
        gpa = b.gpa;
      }
    }

    return {
      tenant,
      settings,
      exam,
      student: stu,
      subjects: rowsOut,
      totalObtained,
      totalMax,
      percent,
      grade: gradeName,
      gpa,
      status: (anyFail ? "FAIL" : "PASS") as "PASS" | "FAIL" | "N/A",
    };
  });
