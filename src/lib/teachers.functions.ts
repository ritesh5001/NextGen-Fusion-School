/**
 * Teachers CRUD + subject/class assignments. Tenant scoped.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, ilike, or, sql, desc, asc } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId) throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

const listInput = z.object({
  query: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const listTeachers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { teachers } = await import("@/db/schema");
    const db = getDb();

    const conds = [eq(teachers.tenantId, tid)];
    if (data.query) {
      const q = `%${data.query}%`;
      conds.push(
        or(
          ilike(teachers.firstName, q),
          ilike(teachers.lastName, q),
          ilike(teachers.employeeCode, q),
          ilike(teachers.email, q),
          ilike(teachers.phone, q),
        )!,
      );
    }
    const where = and(...conds);
    const totalRow = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(teachers)
      .where(where);
    const total = totalRow[0]?.n ?? 0;
    const rows = await db
      .select()
      .from(teachers)
      .where(where)
      .orderBy(desc(teachers.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);
    return { total, rows, page: data.page, pageSize: data.pageSize };
  });

/** Lightweight list for dropdowns. */
export const listTeachersLite = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { teachers } = await import("@/db/schema");
    const db = getDb();
    return db
      .select({
        id: teachers.id,
        firstName: teachers.firstName,
        lastName: teachers.lastName,
        employeeCode: teachers.employeeCode,
      })
      .from(teachers)
      .where(and(eq(teachers.tenantId, tid), eq(teachers.isActive, true)))
      .orderBy(asc(teachers.firstName));
  });

const upsertTeacherInput = z.object({
  id: z.string().uuid().optional(),
  employeeCode: z.string().min(1).max(60),
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  dob: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  qualification: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  joinedOn: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const saveTeacher = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertTeacherInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { teachers } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      tenantId: tid,
      employeeCode: data.employeeCode.trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName ?? null,
      gender: data.gender ?? null,
      dob: data.dob ? new Date(data.dob) : null,
      phone: data.phone ?? null,
      email: data.email && data.email.length > 0 ? data.email : null,
      qualification: data.qualification ?? null,
      designation: data.designation ?? null,
      joinedOn: data.joinedOn ? new Date(data.joinedOn) : null,
      address: data.address ?? null,
      bio: data.bio ?? null,
      isActive: data.isActive,
      updatedAt: new Date(),
    };
    if (data.id) {
      await db
        .update(teachers)
        .set(payload)
        .where(and(eq(teachers.id, data.id), eq(teachers.tenantId, tid)));
      return { ok: true, id: data.id };
    }
    const [row] = await db.insert(teachers).values(payload).returning();
    return { ok: true, id: row.id };
  });

export const deleteTeacher = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { teachers } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(teachers)
      .where(and(eq(teachers.id, data.id), eq(teachers.tenantId, tid)));
    return { ok: true };
  });
