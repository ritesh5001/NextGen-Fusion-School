/**
 * Academic entities: academic years, classes, sections, subjects.
 * All scoped to context.tenantId. Super admins must pass ?tenantId= override.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, asc } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null; isSuperAdmin: boolean }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ================= ACADEMIC YEARS ================= */

export const listAcademicYears = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { academicYears } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(academicYears)
      .where(eq(academicYears.tenantId, tid))
      .orderBy(desc(academicYears.startsOn));
  });

const upsertYearInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  startsOn: z.string(), // ISO date
  endsOn: z.string(),
  isCurrent: z.boolean().default(false),
});

export const saveAcademicYear = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertYearInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { academicYears } = await import("@/db/schema");
    const db = getDb();

    if (data.isCurrent) {
      await db
        .update(academicYears)
        .set({ isCurrent: false })
        .where(eq(academicYears.tenantId, tid));
    }
    const payload = {
      tenantId: tid,
      name: data.name,
      startsOn: new Date(data.startsOn),
      endsOn: new Date(data.endsOn),
      isCurrent: data.isCurrent,
    };
    if (data.id) {
      await db
        .update(academicYears)
        .set(payload)
        .where(and(eq(academicYears.id, data.id), eq(academicYears.tenantId, tid)));
      return { ok: true, id: data.id };
    }
    const [row] = await db.insert(academicYears).values(payload).returning();
    return { ok: true, id: row.id };
  });

export const deleteAcademicYear = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { academicYears } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(academicYears)
      .where(and(eq(academicYears.id, data.id), eq(academicYears.tenantId, tid)));
    return { ok: true };
  });

/* ================= CLASSES ================= */

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { classes, sections, academicYears } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    return db
      .select({
        id: classes.id,
        name: classes.name,
        numericGrade: classes.numericGrade,
        academicYearId: classes.academicYearId,
        academicYearName: academicYears.name,
        sectionCount: sql<number>`(select count(*)::int from ${sections} where ${sections.classId} = ${classes.id})`,
      })
      .from(classes)
      .leftJoin(academicYears, eq(classes.academicYearId, academicYears.id))
      .where(eq(classes.tenantId, tid))
      .orderBy(asc(classes.numericGrade), asc(classes.name));
  });

const upsertClassInput = z.object({
  id: z.string().uuid().optional(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1),
  numericGrade: z.number().int().min(1).max(20).optional().nullable(),
});

export const saveClass = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertClassInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { classes } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      tenantId: tid,
      academicYearId: data.academicYearId,
      name: data.name,
      numericGrade: data.numericGrade ?? null,
    };
    if (data.id) {
      await db
        .update(classes)
        .set(payload)
        .where(and(eq(classes.id, data.id), eq(classes.tenantId, tid)));
      return { ok: true, id: data.id };
    }
    const [row] = await db.insert(classes).values(payload).returning();
    return { ok: true, id: row.id };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { classes } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(classes)
      .where(and(eq(classes.id, data.id), eq(classes.tenantId, tid)));
    return { ok: true };
  });

/* ================= SECTIONS ================= */

export const listSections = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ classId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { sections } = await import("@/db/schema");
    const db = getDb();
    const cond = data.classId
      ? and(eq(sections.tenantId, tid), eq(sections.classId, data.classId))
      : eq(sections.tenantId, tid);
    return db.select().from(sections).where(cond).orderBy(asc(sections.name));
  });

const upsertSectionInput = z.object({
  id: z.string().uuid().optional(),
  classId: z.string().uuid(),
  name: z.string().min(1).max(20),
  capacity: z.number().int().min(1).max(500),
  classTeacherId: z.string().uuid().optional().nullable(),
});

export const saveSection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertSectionInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { sections } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      tenantId: tid,
      classId: data.classId,
      name: data.name,
      capacity: data.capacity,
      classTeacherId: data.classTeacherId ?? null,
    };
    if (data.id) {
      await db
        .update(sections)
        .set(payload)
        .where(and(eq(sections.id, data.id), eq(sections.tenantId, tid)));
      return { ok: true, id: data.id };
    }
    const [row] = await db.insert(sections).values(payload).returning();
    return { ok: true, id: row.id };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { sections } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(sections)
      .where(and(eq(sections.id, data.id), eq(sections.tenantId, tid)));
    return { ok: true };
  });
