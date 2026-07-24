/**
 * HRM — employees, leave types & requests, HR policies, work-outside logs.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { requirePlan } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ================== EMPLOYEES ================== */
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({ q: z.string().optional(), activeOnly: z.boolean().optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { employees } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(employees.tenantId, tid)];
    if (data.activeOnly) conds.push(eq(employees.isActive, true));
    if (data.q) {
      conds.push(
        sql`(${employees.firstName} ILIKE ${"%" + data.q + "%"} OR ${employees.lastName} ILIKE ${"%" + data.q + "%"} OR ${employees.employeeCode} ILIKE ${"%" + data.q + "%"})`,
      );
    }
    return db
      .select()
      .from(employees)
      .where(and(...conds))
      .orderBy(desc(employees.createdAt));
  });

const employeeUpsert = z.object({
  id: z.string().uuid().optional(),
  employeeCode: z.string().min(1).max(40),
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  designation: z.string().max(80).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  joinedOn: z.string().optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  bankName: z.string().max(80).optional().nullable(),
  bankAccountNo: z.string().max(40).optional().nullable(),
  bankIfsc: z.string().max(20).optional().nullable(),
  panNo: z.string().max(20).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const saveEmployee = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) => employeeUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { employees } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      employeeCode: data.employeeCode,
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      gender: (data.gender ?? null) as "male" | "female" | "other" | null,
      phone: data.phone ?? null,
      email: data.email && data.email !== "" ? data.email : null,
      designation: data.designation ?? null,
      department: data.department ?? null,
      joinedOn: data.joinedOn ? new Date(data.joinedOn) : null,
      address: data.address ?? null,
      bankName: data.bankName ?? null,
      bankAccountNo: data.bankAccountNo ?? null,
      bankIfsc: data.bankIfsc ?? null,
      panNo: data.panNo ?? null,
      isActive: data.isActive,
    };
    if (data.id) {
      const [row] = await db
        .update(employees)
        .set({ ...payload, updatedAt: new Date() })
        .where(and(eq(employees.id, data.id), eq(employees.tenantId, tid)))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(employees)
      .values({ tenantId: tid, ...payload })
      .returning();
    return row;
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { employees } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(employees)
      .where(and(eq(employees.id, data.id), eq(employees.tenantId, tid)));
    return { ok: true };
  });

/* ================== LEAVE TYPES ================== */
export const listLeaveTypes = createServerFn({ method: "GET" })
  .middleware([requirePlan("max")])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { leaveTypes } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.tenantId, tid))
      .orderBy(leaveTypes.name);
  });

export const saveLeaveType = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        code: z.string().max(20).optional().nullable(),
        annualQuota: z.number().int().min(0).max(365).default(0),
        isPaid: z.boolean().default(true),
        isActive: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { leaveTypes } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      name: data.name,
      code: data.code ?? null,
      annualQuota: data.annualQuota,
      isPaid: data.isPaid,
      isActive: data.isActive,
    };
    if (data.id) {
      const [row] = await db
        .update(leaveTypes)
        .set(payload)
        .where(and(eq(leaveTypes.id, data.id), eq(leaveTypes.tenantId, tid)))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(leaveTypes)
      .values({ tenantId: tid, ...payload })
      .returning();
    return row;
  });

export const deleteLeaveType = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { leaveTypes } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(leaveTypes)
      .where(and(eq(leaveTypes.id, data.id), eq(leaveTypes.tenantId, tid)));
    return { ok: true };
  });

/* ================== LEAVE REQUESTS ================== */
export const listLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({
        employeeId: z.string().uuid().optional(),
        status: z
          .enum(["pending", "approved", "rejected", "cancelled"])
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { leaveRequests, employees, leaveTypes } = await import(
      "@/db/schema"
    );
    const db = getDb();
    const conds = [eq(leaveRequests.tenantId, tid)];
    if (data.employeeId)
      conds.push(eq(leaveRequests.employeeId, data.employeeId));
    if (data.status) conds.push(eq(leaveRequests.status, data.status));
    return db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeCode: employees.employeeCode,
        employeeName: sql<string>`${employees.firstName} || ' ' || coalesce(${employees.lastName}, '')`,
        leaveTypeId: leaveRequests.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        fromDate: leaveRequests.fromDate,
        toDate: leaveRequests.toDate,
        days: leaveRequests.days,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        decisionNote: leaveRequests.decisionNote,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .leftJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(and(...conds))
      .orderBy(desc(leaveRequests.createdAt));
  });

export const saveLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        employeeId: z.string().uuid(),
        leaveTypeId: z.string().uuid().optional().nullable(),
        fromDate: z.string(),
        toDate: z.string(),
        days: z.number().int().min(1).max(365),
        reason: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { leaveRequests } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      employeeId: data.employeeId,
      leaveTypeId: data.leaveTypeId ?? null,
      fromDate: data.fromDate,
      toDate: data.toDate,
      days: data.days,
      reason: data.reason ?? null,
    };
    if (data.id) {
      const [row] = await db
        .update(leaveRequests)
        .set(payload)
        .where(
          and(eq(leaveRequests.id, data.id), eq(leaveRequests.tenantId, tid)),
        )
        .returning();
      return row;
    }
    const [row] = await db
      .insert(leaveRequests)
      .values({ tenantId: tid, ...payload })
      .returning();
    return row;
  });

export const decideLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "cancelled"]),
        decisionNote: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { leaveRequests } = await import("@/db/schema");
    const db = getDb();
    const [row] = await db
      .update(leaveRequests)
      .set({
        status: data.status,
        decisionNote: data.decisionNote ?? null,
        decidedBy: context.userId,
        decidedAt: new Date(),
      })
      .where(and(eq(leaveRequests.id, data.id), eq(leaveRequests.tenantId, tid)))
      .returning();
    return row;
  });

export const deleteLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { leaveRequests } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(leaveRequests)
      .where(
        and(eq(leaveRequests.id, data.id), eq(leaveRequests.tenantId, tid)),
      );
    return { ok: true };
  });

/* ================== HR POLICIES ================== */
export const listPolicies = createServerFn({ method: "GET" })
  .middleware([requirePlan("max")])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hrPolicies } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(hrPolicies)
      .where(eq(hrPolicies.tenantId, tid))
      .orderBy(desc(hrPolicies.createdAt));
  });

export const savePolicy = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        effectiveFrom: z.string().optional().nullable(),
        isActive: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hrPolicies } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      title: data.title,
      body: data.body,
      effectiveFrom: data.effectiveFrom ?? null,
      isActive: data.isActive,
    };
    if (data.id) {
      const [row] = await db
        .update(hrPolicies)
        .set(payload)
        .where(and(eq(hrPolicies.id, data.id), eq(hrPolicies.tenantId, tid)))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(hrPolicies)
      .values({ tenantId: tid, ...payload })
      .returning();
    return row;
  });

export const deletePolicy = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hrPolicies } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(hrPolicies)
      .where(and(eq(hrPolicies.id, data.id), eq(hrPolicies.tenantId, tid)));
    return { ok: true };
  });

/* ================== WORK OUTSIDE ================== */
export const listWorkOutside = createServerFn({ method: "GET" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({
        employeeId: z.string().uuid().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { workOutsideLogs, employees } = await import("@/db/schema");
    const { gte, lte } = await import("drizzle-orm");
    const db = getDb();
    const conds = [eq(workOutsideLogs.tenantId, tid)];
    if (data.employeeId)
      conds.push(eq(workOutsideLogs.employeeId, data.employeeId));
    if (data.from) conds.push(gte(workOutsideLogs.logDate, data.from));
    if (data.to) conds.push(lte(workOutsideLogs.logDate, data.to));
    return db
      .select({
        id: workOutsideLogs.id,
        employeeId: workOutsideLogs.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || coalesce(${employees.lastName}, '')`,
        employeeCode: employees.employeeCode,
        logDate: workOutsideLogs.logDate,
        location: workOutsideLogs.location,
        purpose: workOutsideLogs.purpose,
        hours: workOutsideLogs.hours,
        note: workOutsideLogs.note,
      })
      .from(workOutsideLogs)
      .leftJoin(employees, eq(employees.id, workOutsideLogs.employeeId))
      .where(and(...conds))
      .orderBy(desc(workOutsideLogs.logDate));
  });

export const saveWorkOutside = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        employeeId: z.string().uuid(),
        logDate: z.string(),
        location: z.string().max(120).optional().nullable(),
        purpose: z.string().min(1).max(200),
        hours: z.number().int().min(0).max(24).optional().nullable(),
        note: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { workOutsideLogs } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      employeeId: data.employeeId,
      logDate: data.logDate,
      location: data.location ?? null,
      purpose: data.purpose,
      hours: data.hours ?? null,
      note: data.note ?? null,
    };
    if (data.id) {
      const [row] = await db
        .update(workOutsideLogs)
        .set(payload)
        .where(
          and(
            eq(workOutsideLogs.id, data.id),
            eq(workOutsideLogs.tenantId, tid),
          ),
        )
        .returning();
      return row;
    }
    const [row] = await db
      .insert(workOutsideLogs)
      .values({ tenantId: tid, ...payload })
      .returning();
    return row;
  });

export const deleteWorkOutside = createServerFn({ method: "POST" })
  .middleware([requirePlan("max")])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { workOutsideLogs } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(workOutsideLogs)
      .where(
        and(
          eq(workOutsideLogs.id, data.id),
          eq(workOutsideLogs.tenantId, tid),
        ),
      );
    return { ok: true };
  });
