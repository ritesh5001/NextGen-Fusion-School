/**
 * Payroll — salary components, templates, employee assignments, payslips.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ================== COMPONENTS ================== */
export const listComponents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { salaryComponents } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(salaryComponents)
      .where(eq(salaryComponents.tenantId, tid))
      .orderBy(salaryComponents.name);
  });

export const saveComponent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        code: z.string().max(20).optional().nullable(),
        kind: z.enum(["earning", "deduction"]),
        isPercentage: z.boolean().default(false),
        defaultValue: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { salaryComponents } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      name: data.name,
      code: data.code ?? null,
      kind: data.kind,
      isPercentage: data.isPercentage,
      defaultValue: data.defaultValue,
      isActive: data.isActive,
    };
    if (data.id) {
      const [row] = await db
        .update(salaryComponents)
        .set(payload)
        .where(
          and(
            eq(salaryComponents.id, data.id),
            eq(salaryComponents.tenantId, tid),
          ),
        )
        .returning();
      return row;
    }
    const [row] = await db
      .insert(salaryComponents)
      .values({ tenantId: tid, ...payload })
      .returning();
    return row;
  });

export const deleteComponent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { salaryComponents } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(salaryComponents)
      .where(
        and(
          eq(salaryComponents.id, data.id),
          eq(salaryComponents.tenantId, tid),
        ),
      );
    return { ok: true };
  });

/* ================== TEMPLATES ================== */
export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { salaryTemplates, salaryTemplateComponents, salaryComponents } =
      await import("@/db/schema");
    const db = getDb();
    const templates = await db
      .select()
      .from(salaryTemplates)
      .where(eq(salaryTemplates.tenantId, tid))
      .orderBy(desc(salaryTemplates.createdAt));
    if (templates.length === 0) return [];
    const ids = templates.map((t) => t.id);
    const links = await db
      .select({
        id: salaryTemplateComponents.id,
        templateId: salaryTemplateComponents.templateId,
        componentId: salaryTemplateComponents.componentId,
        value: salaryTemplateComponents.value,
        name: salaryComponents.name,
        kind: salaryComponents.kind,
        isPercentage: salaryComponents.isPercentage,
      })
      .from(salaryTemplateComponents)
      .leftJoin(
        salaryComponents,
        eq(salaryComponents.id, salaryTemplateComponents.componentId),
      )
      .where(
        sql`${salaryTemplateComponents.templateId} = ANY(ARRAY[${sql.join(
          ids.map((i) => sql`${i}::uuid`),
          sql`, `,
        )}])`,
      );
    return templates.map((t) => ({
      ...t,
      components: links.filter((l) => l.templateId === t.id),
    }));
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(300).optional().nullable(),
        isActive: z.boolean().default(true),
        components: z
          .array(
            z.object({
              componentId: z.string().uuid(),
              value: z.number().int().min(0),
            }),
          )
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { salaryTemplates, salaryTemplateComponents } = await import(
      "@/db/schema"
    );
    const db = getDb();
    let templateId = data.id;
    if (templateId) {
      await db
        .update(salaryTemplates)
        .set({
          name: data.name,
          description: data.description ?? null,
          isActive: data.isActive,
        })
        .where(
          and(
            eq(salaryTemplates.id, templateId),
            eq(salaryTemplates.tenantId, tid),
          ),
        );
      await db
        .delete(salaryTemplateComponents)
        .where(eq(salaryTemplateComponents.templateId, templateId));
    } else {
      const [row] = await db
        .insert(salaryTemplates)
        .values({
          tenantId: tid,
          name: data.name,
          description: data.description ?? null,
          isActive: data.isActive,
        })
        .returning();
      templateId = row.id;
    }
    if (data.components.length > 0) {
      await db.insert(salaryTemplateComponents).values(
        data.components.map((c) => ({
          templateId: templateId!,
          componentId: c.componentId,
          value: c.value,
        })),
      );
    }
    return { id: templateId };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { salaryTemplates } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(salaryTemplates)
      .where(
        and(
          eq(salaryTemplates.id, data.id),
          eq(salaryTemplates.tenantId, tid),
        ),
      );
    return { ok: true };
  });

/* ================== ASSIGNMENTS ================== */
export const listAssignments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { employeeSalaryAssignments, employees, salaryTemplates } =
      await import("@/db/schema");
    const db = getDb();
    return db
      .select({
        id: employeeSalaryAssignments.id,
        employeeId: employeeSalaryAssignments.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || coalesce(${employees.lastName}, '')`,
        employeeCode: employees.employeeCode,
        templateId: employeeSalaryAssignments.templateId,
        templateName: salaryTemplates.name,
        basic: employeeSalaryAssignments.basic,
        effectiveFrom: employeeSalaryAssignments.effectiveFrom,
        isActive: employeeSalaryAssignments.isActive,
      })
      .from(employeeSalaryAssignments)
      .leftJoin(
        employees,
        eq(employees.id, employeeSalaryAssignments.employeeId),
      )
      .leftJoin(
        salaryTemplates,
        eq(salaryTemplates.id, employeeSalaryAssignments.templateId),
      )
      .where(eq(employeeSalaryAssignments.tenantId, tid))
      .orderBy(desc(employeeSalaryAssignments.effectiveFrom));
  });

export const saveAssignment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        employeeId: z.string().uuid(),
        templateId: z.string().uuid(),
        basic: z.number().int().min(0),
        effectiveFrom: z.string(),
        isActive: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { employeeSalaryAssignments } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      const [row] = await db
        .update(employeeSalaryAssignments)
        .set({
          employeeId: data.employeeId,
          templateId: data.templateId,
          basic: data.basic,
          effectiveFrom: data.effectiveFrom,
          isActive: data.isActive,
        })
        .where(
          and(
            eq(employeeSalaryAssignments.id, data.id),
            eq(employeeSalaryAssignments.tenantId, tid),
          ),
        )
        .returning();
      return row;
    }
    // Deactivate previous active assignments for this employee
    if (data.isActive) {
      await db
        .update(employeeSalaryAssignments)
        .set({ isActive: false })
        .where(
          and(
            eq(employeeSalaryAssignments.tenantId, tid),
            eq(employeeSalaryAssignments.employeeId, data.employeeId),
          ),
        );
    }
    const [row] = await db
      .insert(employeeSalaryAssignments)
      .values({
        tenantId: tid,
        employeeId: data.employeeId,
        templateId: data.templateId,
        basic: data.basic,
        effectiveFrom: data.effectiveFrom,
        isActive: data.isActive,
      })
      .returning();
    return row;
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { employeeSalaryAssignments } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(employeeSalaryAssignments)
      .where(
        and(
          eq(employeeSalaryAssignments.id, data.id),
          eq(employeeSalaryAssignments.tenantId, tid),
        ),
      );
    return { ok: true };
  });

/* ================== PAYSLIPS ================== */
export const listPayslips = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        year: z.number().int().optional(),
        month: z.number().int().optional(),
        employeeId: z.string().uuid().optional(),
        status: z.enum(["draft", "finalized", "paid"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { payslips, employees } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(payslips.tenantId, tid)];
    if (data.year !== undefined) conds.push(eq(payslips.periodYear, data.year));
    if (data.month !== undefined)
      conds.push(eq(payslips.periodMonth, data.month));
    if (data.employeeId) conds.push(eq(payslips.employeeId, data.employeeId));
    if (data.status) conds.push(eq(payslips.status, data.status));
    return db
      .select({
        id: payslips.id,
        employeeId: payslips.employeeId,
        employeeCode: employees.employeeCode,
        employeeName: sql<string>`${employees.firstName} || ' ' || coalesce(${employees.lastName}, '')`,
        periodYear: payslips.periodYear,
        periodMonth: payslips.periodMonth,
        basic: payslips.basic,
        grossEarnings: payslips.grossEarnings,
        totalDeductions: payslips.totalDeductions,
        netPay: payslips.netPay,
        status: payslips.status,
        paidAt: payslips.paidAt,
        paidVia: payslips.paidVia,
      })
      .from(payslips)
      .leftJoin(employees, eq(employees.id, payslips.employeeId))
      .where(and(...conds))
      .orderBy(desc(payslips.periodYear), desc(payslips.periodMonth));
  });

export const getPayslip = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { payslips, payslipItems, employees } = await import("@/db/schema");
    const db = getDb();
    const [slip] = await db
      .select({
        id: payslips.id,
        employeeId: payslips.employeeId,
        employeeCode: employees.employeeCode,
        employeeName: sql<string>`${employees.firstName} || ' ' || coalesce(${employees.lastName}, '')`,
        designation: employees.designation,
        department: employees.department,
        bankName: employees.bankName,
        bankAccountNo: employees.bankAccountNo,
        periodYear: payslips.periodYear,
        periodMonth: payslips.periodMonth,
        basic: payslips.basic,
        grossEarnings: payslips.grossEarnings,
        totalDeductions: payslips.totalDeductions,
        netPay: payslips.netPay,
        status: payslips.status,
        paidAt: payslips.paidAt,
        paidVia: payslips.paidVia,
        reference: payslips.reference,
        note: payslips.note,
      })
      .from(payslips)
      .leftJoin(employees, eq(employees.id, payslips.employeeId))
      .where(and(eq(payslips.id, data.id), eq(payslips.tenantId, tid)));
    if (!slip) throw new Response("Not found", { status: 404 });
    const items = await db
      .select()
      .from(payslipItems)
      .where(eq(payslipItems.payslipId, data.id));
    return { ...slip, items };
  });

export const generatePayslips = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        employeeIds: z.array(z.string().uuid()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const {
      employeeSalaryAssignments,
      salaryTemplateComponents,
      salaryComponents,
      payslips,
      payslipItems,
    } = await import("@/db/schema");
    const db = getDb();

    // Fetch active assignments (optionally scoped to selected employees)
    const conds = [
      eq(employeeSalaryAssignments.tenantId, tid),
      eq(employeeSalaryAssignments.isActive, true),
    ];
    if (data.employeeIds && data.employeeIds.length > 0) {
      const ids = data.employeeIds;
      conds.push(
        sql`${employeeSalaryAssignments.employeeId} = ANY(ARRAY[${sql.join(
          ids.map((i) => sql`${i}::uuid`),
          sql`, `,
        )}])`,
      );
    }
    const assignments = await db
      .select()
      .from(employeeSalaryAssignments)
      .where(and(...conds));

    let created = 0;
    let skipped = 0;

    for (const asg of assignments) {
      // Skip if payslip already exists for the period
      const existing = await db
        .select({ id: payslips.id })
        .from(payslips)
        .where(
          and(
            eq(payslips.tenantId, tid),
            eq(payslips.employeeId, asg.employeeId),
            eq(payslips.periodYear, data.year),
            eq(payslips.periodMonth, data.month),
          ),
        );
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Get template components
      const links = await db
        .select({
          value: salaryTemplateComponents.value,
          name: salaryComponents.name,
          kind: salaryComponents.kind,
          isPercentage: salaryComponents.isPercentage,
          componentId: salaryComponents.id,
        })
        .from(salaryTemplateComponents)
        .leftJoin(
          salaryComponents,
          eq(salaryComponents.id, salaryTemplateComponents.componentId),
        )
        .where(eq(salaryTemplateComponents.templateId, asg.templateId));

      let grossEarnings = asg.basic;
      let totalDeductions = 0;
      const itemsToInsert: Array<{
        label: string;
        kind: "earning" | "deduction";
        amount: number;
        componentId: string | null;
      }> = [
        {
          label: "Basic",
          kind: "earning",
          amount: asg.basic,
          componentId: null,
        },
      ];

      for (const l of links) {
        if (!l.kind || !l.name) continue;
        const amount = l.isPercentage
          ? Math.round((asg.basic * l.value) / 100)
          : l.value;
        if (l.kind === "earning") grossEarnings += amount;
        else totalDeductions += amount;
        itemsToInsert.push({
          label: l.name,
          kind: l.kind,
          amount,
          componentId: l.componentId ?? null,
        });
      }

      const netPay = grossEarnings - totalDeductions;

      const [slip] = await db
        .insert(payslips)
        .values({
          tenantId: tid,
          employeeId: asg.employeeId,
          periodYear: data.year,
          periodMonth: data.month,
          basic: asg.basic,
          grossEarnings,
          totalDeductions,
          netPay,
          status: "draft",
        })
        .returning();

      if (itemsToInsert.length > 0) {
        await db.insert(payslipItems).values(
          itemsToInsert.map((it) => ({
            payslipId: slip.id,
            label: it.label,
            kind: it.kind,
            amount: it.amount,
            componentId: it.componentId,
          })),
        );
      }
      created++;
    }
    return { created, skipped };
  });

export const finalizePayslip = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { payslips } = await import("@/db/schema");
    const db = getDb();
    const [row] = await db
      .update(payslips)
      .set({ status: "finalized" })
      .where(and(eq(payslips.id, data.id), eq(payslips.tenantId, tid)))
      .returning();
    return row;
  });

export const payPayslip = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        paidVia: z.string().max(40),
        reference: z.string().max(120).optional().nullable(),
        note: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { payslips } = await import("@/db/schema");
    const db = getDb();
    const [row] = await db
      .update(payslips)
      .set({
        status: "paid",
        paidAt: new Date(),
        paidVia: data.paidVia,
        reference: data.reference ?? null,
        note: data.note ?? null,
      })
      .where(and(eq(payslips.id, data.id), eq(payslips.tenantId, tid)))
      .returning();
    return row;
  });

export const deletePayslip = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { payslips } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(payslips)
      .where(and(eq(payslips.id, data.id), eq(payslips.tenantId, tid)));
    return { ok: true };
  });
