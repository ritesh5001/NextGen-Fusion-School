/**
 * Subjects CRUD + class-subject-teacher mapping. Tenant scoped.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { subjects } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(subjects)
      .where(eq(subjects.tenantId, tid))
      .orderBy(asc(subjects.name));
  });

const upsertSubjectInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  code: z.string().optional().nullable(),
});

export const saveSubject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertSubjectInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { subjects } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      tenantId: tid,
      name: data.name.trim(),
      code: data.code && data.code.trim().length > 0 ? data.code.trim() : null,
    };
    if (data.id) {
      await db
        .update(subjects)
        .set(payload)
        .where(and(eq(subjects.id, data.id), eq(subjects.tenantId, tid)));
      return { ok: true, id: data.id };
    }
    const [row] = await db.insert(subjects).values(payload).returning();
    return { ok: true, id: row.id };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { subjects } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(subjects)
      .where(and(eq(subjects.id, data.id), eq(subjects.tenantId, tid)));
    return { ok: true };
  });

/* ============= Class ↔ Subject ↔ Teacher mapping ============= */

export const listAssignments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        classId: z.string().uuid().optional(),
        sectionId: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { classSubjectTeachers, classes, sections, subjects, teachers } =
      await import("@/db/schema");
    const db = getDb();
    const conds = [eq(classSubjectTeachers.tenantId, tid)];
    if (data.classId) conds.push(eq(classSubjectTeachers.classId, data.classId));
    if (data.sectionId)
      conds.push(eq(classSubjectTeachers.sectionId, data.sectionId));
    return db
      .select({
        id: classSubjectTeachers.id,
        classId: classSubjectTeachers.classId,
        className: classes.name,
        sectionId: classSubjectTeachers.sectionId,
        sectionName: sections.name,
        subjectId: classSubjectTeachers.subjectId,
        subjectName: subjects.name,
        teacherId: classSubjectTeachers.teacherId,
        teacherFirstName: teachers.firstName,
        teacherLastName: teachers.lastName,
      })
      .from(classSubjectTeachers)
      .leftJoin(classes, eq(classSubjectTeachers.classId, classes.id))
      .leftJoin(sections, eq(classSubjectTeachers.sectionId, sections.id))
      .leftJoin(subjects, eq(classSubjectTeachers.subjectId, subjects.id))
      .leftJoin(teachers, eq(classSubjectTeachers.teacherId, teachers.id))
      .where(and(...conds))
      .orderBy(asc(classes.name), asc(subjects.name));
  });

const upsertAssignmentInput = z.object({
  classId: z.string().uuid(),
  sectionId: z.string().uuid().optional().nullable(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
});

export const saveAssignment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertAssignmentInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { classSubjectTeachers } = await import("@/db/schema");
    const db = getDb();
    const [row] = await db
      .insert(classSubjectTeachers)
      .values({
        tenantId: tid,
        classId: data.classId,
        sectionId: data.sectionId ?? null,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
      })
      .onConflictDoNothing()
      .returning();
    return { ok: true, id: row?.id };
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { classSubjectTeachers } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(classSubjectTeachers)
      .where(
        and(
          eq(classSubjectTeachers.id, data.id),
          eq(classSubjectTeachers.tenantId, tid),
        ),
      );
    return { ok: true };
  });
