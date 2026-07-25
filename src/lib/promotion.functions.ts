/**
 * Student promotion — bulk-move students between academic years / classes / sections.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listPromotionCandidates = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "promotion.read" })])
  .inputValidator((d: unknown) =>
    z.object({ classId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students } = await import("@/db/schema");
    const db = getDb();
    return db
      .select({
        id: students.id,
        admissionNo: students.admissionNo,
        firstName: students.firstName,
        lastName: students.lastName,
        rollNo: students.rollNo,
        classId: students.classId,
        sectionId: students.sectionId,
        academicYearId: students.academicYearId,
      })
      .from(students)
      .where(
        and(
          eq(students.tenantId, tid),
          eq(students.classId, data.classId),
          eq(students.isActive, true),
        ),
      )
      .orderBy(students.rollNo, students.firstName);
  });

const promoteInput = z.object({
  toAcademicYearId: z.string().uuid(),
  toClassId: z.string().uuid().optional().nullable(),
  toSectionId: z.string().uuid().optional().nullable(),
  outcome: z.enum(["promoted", "retained", "alumni"]),
  studentIds: z.array(z.string().uuid()).min(1),
});

export const promoteStudents = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["promotion.create", "promotion.update", "promotion.delete"] })])
  .inputValidator((d: unknown) => promoteInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, promotionLogs } = await import("@/db/schema");
    const db = getDb();

    const current = await db
      .select()
      .from(students)
      .where(
        and(
          eq(students.tenantId, tid),
          inArray(students.id, data.studentIds),
        ),
      );

    for (const stu of current) {
      if (data.outcome === "alumni") {
        await db
          .update(students)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(students.id, stu.id));
      } else if (data.outcome === "promoted") {
        await db
          .update(students)
          .set({
            classId: data.toClassId ?? stu.classId,
            sectionId: data.toSectionId ?? null,
            academicYearId: data.toAcademicYearId,
            updatedAt: new Date(),
          })
          .where(eq(students.id, stu.id));
      } else if (data.outcome === "retained") {
        await db
          .update(students)
          .set({
            academicYearId: data.toAcademicYearId,
            updatedAt: new Date(),
          })
          .where(eq(students.id, stu.id));
      }

      await db.insert(promotionLogs).values({
        tenantId: tid,
        studentId: stu.id,
        fromYearId: stu.academicYearId,
        toYearId: data.toAcademicYearId,
        fromClassId: stu.classId,
        fromSectionId: stu.sectionId,
        toClassId:
          data.outcome === "promoted"
            ? data.toClassId ?? stu.classId
            : stu.classId,
        toSectionId:
          data.outcome === "promoted" ? data.toSectionId ?? null : stu.sectionId,
        outcome: data.outcome,
        performedBy: context.userId ?? null,
      });
    }

    return { moved: current.length };
  });
