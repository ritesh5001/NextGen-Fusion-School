/**
 * ID Cards — template CRUD + batch fetch for printing.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, inArray } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listIdTemplates = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "idcards.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { idCardTemplates } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(idCardTemplates)
      .where(eq(idCardTemplates.tenantId, tid))
      .orderBy(desc(idCardTemplates.createdAt));
  });

const tplUpsert = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  audience: z.enum(["student", "teacher", "employee"]).default("student"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  widthMm: z.number().int().positive().default(54),
  heightMm: z.number().int().positive().default(86),
  accentColor: z.string().max(20).default("#10b981"),
  backgroundColor: z.string().max(20).default("#ffffff"),
  textColor: z.string().max(20).default("#0a0a0a"),
  logoUrl: z.string().max(500).optional().nullable(),
  showPhoto: z.boolean().default(true),
  showQr: z.boolean().default(true),
  footerText: z.string().max(200).optional().nullable(),
  isDefault: z.boolean().default(false),
});

export const saveIdTemplate = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["idcards.create", "idcards.update", "idcards.delete"] })])
  .inputValidator((d: unknown) => tplUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { idCardTemplates } = await import("@/db/schema");
    const db = getDb();
    if (data.isDefault) {
      await db
        .update(idCardTemplates)
        .set({ isDefault: false })
        .where(
          and(
            eq(idCardTemplates.tenantId, tid),
            eq(idCardTemplates.audience, data.audience),
          ),
        );
    }
    const values = {
      name: data.name,
      audience: data.audience,
      orientation: data.orientation,
      widthMm: data.widthMm,
      heightMm: data.heightMm,
      accentColor: data.accentColor,
      backgroundColor: data.backgroundColor,
      textColor: data.textColor,
      logoUrl: data.logoUrl ?? null,
      showPhoto: data.showPhoto,
      showQr: data.showQr,
      footerText: data.footerText ?? null,
      isDefault: data.isDefault,
    };
    if (data.id) {
      await db
        .update(idCardTemplates)
        .set(values)
        .where(
          and(eq(idCardTemplates.id, data.id), eq(idCardTemplates.tenantId, tid)),
        );
      return { id: data.id };
    }
    const [row] = await db
      .insert(idCardTemplates)
      .values({ tenantId: tid, ...values })
      .returning({ id: idCardTemplates.id });
    return { id: row.id };
  });

export const deleteIdTemplate = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["idcards.create", "idcards.update", "idcards.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { idCardTemplates } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(idCardTemplates)
      .where(
        and(eq(idCardTemplates.id, data.id), eq(idCardTemplates.tenantId, tid)),
      );
    return { ok: true };
  });

export const getIdCardBatch = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "idcards.read" })])
  .inputValidator((d: unknown) =>
    z
      .object({
        audience: z.enum(["student", "teacher", "employee"]),
        studentIds: z.array(z.string().uuid()).optional(),
        classId: z.string().uuid().optional(),
        sectionId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { students, teachers, employees, classes, sections, tenants } =
      await import("@/db/schema");
    const db = getDb();
    const [tenant] = await db
      .select({
        name: tenants.name,
        slug: tenants.slug,
      })
      .from(tenants)
      .where(eq(tenants.id, tid));
    if (data.audience === "student") {
      const conds = [eq(students.tenantId, tid)];
      if (data.classId) conds.push(eq(students.classId, data.classId));
      if (data.sectionId) conds.push(eq(students.sectionId, data.sectionId));
      if (data.studentIds && data.studentIds.length)
        conds.push(inArray(students.id, data.studentIds));
      const rows = await db
        .select({
          id: students.id,
          code: students.admissionNo,
          firstName: students.firstName,
          lastName: students.lastName,
          photoUrl: students.photoUrl,
          className: classes.name,
          sectionName: sections.name,
          guardianPhone: students.guardianPhone,
        })
        .from(students)
        .leftJoin(classes, eq(students.classId, classes.id))
        .leftJoin(sections, eq(students.sectionId, sections.id))
        .where(and(...conds))
        .limit(500);
      return { tenant, rows };
    }
    if (data.audience === "teacher") {
      const rows = await db
        .select({
          id: teachers.id,
          code: teachers.employeeCode,
          firstName: teachers.firstName,
          lastName: teachers.lastName,
          photoUrl: teachers.photoUrl,
          className: teachers.designation,
          sectionName: teachers.qualification,
          guardianPhone: teachers.phone,
        })
        .from(teachers)
        .where(eq(teachers.tenantId, tid))
        .limit(500);
      return { tenant, rows };
    }
    const rows = await db
      .select({
        id: employees.id,
        code: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        photoUrl: employees.photoUrl,
        className: employees.designation,
        sectionName: employees.department,
        guardianPhone: employees.phone,
      })
      .from(employees)
      .where(eq(employees.tenantId, tid))
      .limit(500);
    return { tenant, rows };
  });
