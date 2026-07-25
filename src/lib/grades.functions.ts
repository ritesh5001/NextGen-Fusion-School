/**
 * Grade scales & grade bands — tenant scoped.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listGradeScales = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "exams.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { gradeScales, grades } = await import("@/db/schema");
    const db = getDb();
    const scales = await db
      .select()
      .from(gradeScales)
      .where(eq(gradeScales.tenantId, tid))
      .orderBy(asc(gradeScales.name));
    const bands = await db
      .select()
      .from(grades)
      .where(eq(grades.tenantId, tid))
      .orderBy(asc(grades.minPercent));
    return scales.map((s) => ({
      ...s,
      bands: bands.filter((b) => b.scaleId === s.id),
    }));
  });

export const saveGradeScale = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["exams.create", "exams.update", "exams.delete"] })])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        isDefault: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { gradeScales } = await import("@/db/schema");
    const db = getDb();
    if (data.isDefault) {
      await db
        .update(gradeScales)
        .set({ isDefault: false })
        .where(eq(gradeScales.tenantId, tid));
    }
    if (data.id) {
      await db
        .update(gradeScales)
        .set({ name: data.name, isDefault: !!data.isDefault })
        .where(and(eq(gradeScales.tenantId, tid), eq(gradeScales.id, data.id)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(gradeScales)
      .values({
        tenantId: tid,
        name: data.name,
        isDefault: !!data.isDefault,
      })
      .returning();
    return { id: row.id };
  });

export const deleteGradeScale = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["exams.create", "exams.update", "exams.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { gradeScales } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(gradeScales)
      .where(and(eq(gradeScales.tenantId, tid), eq(gradeScales.id, data.id)));
    return { ok: true };
  });

export const saveGradeBands = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["exams.create", "exams.update", "exams.delete"] })])
  .inputValidator((d: unknown) =>
    z
      .object({
        scaleId: z.string().uuid(),
        bands: z
          .array(
            z.object({
              name: z.string().min(1).max(20),
              minPercent: z.number().int().min(0).max(100),
              maxPercent: z.number().int().min(0).max(100),
              gpa: z.string().optional().nullable(),
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
    const { grades } = await import("@/db/schema");
    const db = getDb();
    // simple approach: replace all bands
    await db
      .delete(grades)
      .where(and(eq(grades.tenantId, tid), eq(grades.scaleId, data.scaleId)));
    await db.insert(grades).values(
      data.bands.map((b) => ({
        tenantId: tid,
        scaleId: data.scaleId,
        name: b.name,
        minPercent: b.minPercent,
        maxPercent: b.maxPercent,
        gpa: b.gpa ?? null,
        remark: b.remark ?? null,
      })),
    );
    return { ok: true, count: data.bands.length };
  });
