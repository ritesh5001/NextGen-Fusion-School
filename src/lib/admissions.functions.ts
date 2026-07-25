/**
 * Online Admissions — public submit + back-office review/approve/enroll.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, gt, sql } from "drizzle-orm";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ============= PUBLIC ============= */
export const getPublicSchool = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants, classes, academicYears } = await import("@/db/schema");
    const db = getDb();
    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.slug, data.slug));
    if (!tenant) throw new Response("Not found", { status: 404 });
    const clsRows = await db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(eq(classes.tenantId, tenant.id))
      .orderBy(classes.name);
    const [year] = await db
      .select({ id: academicYears.id, name: academicYears.name })
      .from(academicYears)
      .where(
        and(
          eq(academicYears.tenantId, tenant.id),
          eq(academicYears.isCurrent, true),
        ),
      );
    return { tenant, classes: clsRows, currentYear: year ?? null };
  });

const submitSchema = z.object({
  tenantSlug: z.string().min(1),
  classAppliedId: z.string().uuid().optional().nullable(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  dob: z.string().optional().nullable(),
  guardianName: z.string().max(120).optional().nullable(),
  guardianPhone: z.string().max(30).optional().nullable(),
  guardianEmail: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().max(500).optional().nullable(),
  previousSchool: z.string().max(200).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),
  // DPDP: verifiable parental consent is mandatory for a minor's application.
  parentalConsent: z
    .boolean()
    .refine((v) => v === true, "Parental consent is required"),
  consentName: z.string().min(2).max(120),
});

export const submitAdmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants, admissionApplications, academicYears, auditLog } =
      await import("@/db/schema");
    const db = getDb();
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, data.tenantSlug));
    if (!tenant) throw new Response("School not found", { status: 404 });

    // Abuse protection for this PUBLIC endpoint: max 5 submissions per IP per
    // 10 minutes (tracked in the audit log). Add a CAPTCHA for stronger
    // guarantees before high-traffic launch.
    const ip =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown";
    const recent = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "admission.submit"),
          eq(auditLog.entityId, ip),
          gt(auditLog.createdAt, new Date(Date.now() - 10 * 60 * 1000)),
        ),
      );
    if ((recent[0]?.n ?? 0) >= 5) {
      throw new Response("Too many submissions. Please try again later.", {
        status: 429,
      });
    }
    const [year] = await db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(
        and(
          eq(academicYears.tenantId, tenant.id),
          eq(academicYears.isCurrent, true),
        ),
      );
    // generate application number
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(admissionApplications)
      .where(eq(admissionApplications.tenantId, tenant.id));
    const applicationNo = `APP-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
    const [row] = await db
      .insert(admissionApplications)
      .values({
        tenantId: tenant.id,
        applicationNo,
        academicYearId: year?.id ?? null,
        classAppliedId: data.classAppliedId ?? null,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        gender: data.gender ?? null,
        dob: data.dob ?? null,
        guardianName: data.guardianName ?? null,
        guardianPhone: data.guardianPhone ?? null,
        guardianEmail: data.guardianEmail || null,
        address: data.address ?? null,
        previousSchool: data.previousSchool ?? null,
        remarks: data.remarks ?? null,
        parentalConsent: true,
        consentName: data.consentName,
        consentAt: new Date(),
        status: "pending",
      })
      .returning({ id: admissionApplications.id });

    await db.insert(auditLog).values({
      tenantId: tenant.id,
      action: "admission.submit",
      entity: "admission",
      entityId: ip,
    });

    return { id: row.id, applicationNo };
  });

/* ============= ADMIN ============= */
export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "admissions.read" })])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z
          .enum([
            "pending",
            "under_review",
            "approved",
            "rejected",
            "enrolled",
            "all",
          ])
          .default("all"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { admissionApplications, classes } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(admissionApplications.tenantId, tid)];
    if (data.status !== "all")
      conds.push(eq(admissionApplications.status, data.status));
    return db
      .select({
        id: admissionApplications.id,
        applicationNo: admissionApplications.applicationNo,
        firstName: admissionApplications.firstName,
        lastName: admissionApplications.lastName,
        classAppliedId: admissionApplications.classAppliedId,
        className: classes.name,
        guardianName: admissionApplications.guardianName,
        guardianPhone: admissionApplications.guardianPhone,
        guardianEmail: admissionApplications.guardianEmail,
        gender: admissionApplications.gender,
        dob: admissionApplications.dob,
        address: admissionApplications.address,
        previousSchool: admissionApplications.previousSchool,
        remarks: admissionApplications.remarks,
        status: admissionApplications.status,
        reviewNote: admissionApplications.reviewNote,
        submittedAt: admissionApplications.submittedAt,
        enrolledStudentId: admissionApplications.enrolledStudentId,
      })
      .from(admissionApplications)
      .leftJoin(classes, eq(classes.id, admissionApplications.classAppliedId))
      .where(and(...conds))
      .orderBy(desc(admissionApplications.submittedAt));
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["admissions.create", "admissions.update", "admissions.delete"] })])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "pending",
          "under_review",
          "approved",
          "rejected",
        ]),
        reviewNote: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { admissionApplications } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(admissionApplications)
      .set({
        status: data.status,
        reviewNote: data.reviewNote ?? null,
        reviewedBy: context.userId,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(admissionApplications.id, data.id),
          eq(admissionApplications.tenantId, tid),
        ),
      );
    return { ok: true };
  });

export const enrollApplication = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["admissions.create", "admissions.update", "admissions.delete"] })])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        sectionId: z.string().uuid(),
        admissionNo: z.string().min(1).max(40),
        rollNo: z.string().max(20).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { admissionApplications, students, sections } = await import(
      "@/db/schema"
    );
    const db = getDb();
    const [app] = await db
      .select()
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.id, data.id),
          eq(admissionApplications.tenantId, tid),
        ),
      );
    if (!app) throw new Response("Application not found", { status: 404 });
    if (app.status !== "approved")
      throw new Response("Approve first before enrolling", { status: 400 });
    if (!app.classAppliedId)
      throw new Response("No class on application", { status: 400 });
    const [sec] = await db
      .select({ classId: sections.classId })
      .from(sections)
      .where(and(eq(sections.id, data.sectionId), eq(sections.tenantId, tid)));
    if (!sec) throw new Response("Section not found", { status: 404 });
    const [student] = await db
      .insert(students)
      .values({
        tenantId: tid,
        admissionNo: data.admissionNo,
        rollNo: data.rollNo ?? null,
        firstName: app.firstName,
        lastName: app.lastName,
        gender: app.gender,
        dob: app.dob ? new Date(app.dob) : null,
        guardianName: app.guardianName,
        guardianPhone: app.guardianPhone,
        guardianEmail: app.guardianEmail,
        address: app.address,
        classId: sec.classId,
        sectionId: data.sectionId,
        academicYearId: app.academicYearId,
        isActive: true,
      })
      .returning({ id: students.id });
    await db
      .update(admissionApplications)
      .set({ status: "enrolled", enrolledStudentId: student.id })
      .where(eq(admissionApplications.id, data.id));
    return { studentId: student.id };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["admissions.create", "admissions.update", "admissions.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { admissionApplications } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(admissionApplications)
      .where(
        and(
          eq(admissionApplications.id, data.id),
          eq(admissionApplications.tenantId, tid),
        ),
      );
    return { ok: true };
  });
