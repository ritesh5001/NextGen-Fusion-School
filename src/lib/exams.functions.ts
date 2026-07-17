/**
 * Exams & Exam Subject mapping — tenant scoped.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, asc, desc } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ================== EXAMS ================== */

export const listExams = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { exams, academicYears } = await import("@/db/schema");
    const db = getDb();
    return db
      .select({
        id: exams.id,
        name: exams.name,
        term: exams.term,
        startsOn: exams.startsOn,
        endsOn: exams.endsOn,
        isPublished: exams.isPublished,
        academicYearId: exams.academicYearId,
        gradeScaleId: exams.gradeScaleId,
        yearName: academicYears.name,
        createdAt: exams.createdAt,
      })
      .from(exams)
      .leftJoin(academicYears, eq(academicYears.id, exams.academicYearId))
      .where(eq(exams.tenantId, tid))
      .orderBy(desc(exams.createdAt));
  });

const upsertExamInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  term: z.string().max(60).optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
  gradeScaleId: z.string().uuid().optional().nullable(),
  startsOn: z.string().optional().nullable(),
  endsOn: z.string().optional().nullable(),
});

export const saveExam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertExamInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { exams } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(exams)
        .set({
          name: data.name,
          term: data.term ?? null,
          academicYearId: data.academicYearId ?? null,
          gradeScaleId: data.gradeScaleId ?? null,
          startsOn: data.startsOn ?? null,
          endsOn: data.endsOn ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(exams.tenantId, tid), eq(exams.id, data.id)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(exams)
      .values({
        tenantId: tid,
        name: data.name,
        term: data.term ?? null,
        academicYearId: data.academicYearId ?? null,
        gradeScaleId: data.gradeScaleId ?? null,
        startsOn: data.startsOn ?? null,
        endsOn: data.endsOn ?? null,
      })
      .returning();
    return { id: row.id };
  });

export const setExamPublished = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), isPublished: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { exams } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(exams)
      .set({ isPublished: data.isPublished, updatedAt: new Date() })
      .where(and(eq(exams.tenantId, tid), eq(exams.id, data.id)));
    return { ok: true };
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { exams } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(exams)
      .where(and(eq(exams.tenantId, tid), eq(exams.id, data.id)));
    return { ok: true };
  });

/* ================== EXAM SUBJECTS ================== */

export const listExamSubjects = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ examId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { examSubjects, classes, subjects } = await import("@/db/schema");
    const db = getDb();
    return db
      .select({
        id: examSubjects.id,
        examId: examSubjects.examId,
        classId: examSubjects.classId,
        subjectId: examSubjects.subjectId,
        maxMarks: examSubjects.maxMarks,
        passMarks: examSubjects.passMarks,
        examDate: examSubjects.examDate,
        className: classes.name,
        subjectName: subjects.name,
      })
      .from(examSubjects)
      .innerJoin(classes, eq(classes.id, examSubjects.classId))
      .innerJoin(subjects, eq(subjects.id, examSubjects.subjectId))
      .where(
        and(
          eq(examSubjects.tenantId, tid),
          eq(examSubjects.examId, data.examId),
        ),
      )
      .orderBy(asc(classes.name), asc(subjects.name));
  });

export const saveExamSubject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        examId: z.string().uuid(),
        classId: z.string().uuid(),
        subjectId: z.string().uuid(),
        maxMarks: z.number().int().min(1).max(1000),
        passMarks: z.number().int().min(0).max(1000),
        examDate: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { examSubjects } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(examSubjects)
        .set({
          classId: data.classId,
          subjectId: data.subjectId,
          maxMarks: data.maxMarks,
          passMarks: data.passMarks,
          examDate: data.examDate ?? null,
        })
        .where(
          and(eq(examSubjects.tenantId, tid), eq(examSubjects.id, data.id)),
        );
      return { id: data.id };
    }
    const [row] = await db
      .insert(examSubjects)
      .values({
        tenantId: tid,
        examId: data.examId,
        classId: data.classId,
        subjectId: data.subjectId,
        maxMarks: data.maxMarks,
        passMarks: data.passMarks,
        examDate: data.examDate ?? null,
      })
      .returning();
    return { id: row.id };
  });

export const deleteExamSubject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { examSubjects } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(examSubjects)
      .where(
        and(eq(examSubjects.tenantId, tid), eq(examSubjects.id, data.id)),
      );
    return { ok: true };
  });
