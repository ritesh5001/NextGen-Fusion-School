/**
 * Fees module — heads, structures, invoices, payments (tenant scoped).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ================== FEE HEADS ================== */
export const listFeeHeads = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeHeads } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(feeHeads)
      .where(eq(feeHeads.tenantId, tid))
      .orderBy(desc(feeHeads.createdAt));
  });

const upsertHead = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  code: z.string().max(40).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isRecurring: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const saveFeeHead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertHead.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeHeads } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      const [row] = await db
        .update(feeHeads)
        .set({
          name: data.name,
          code: data.code ?? null,
          description: data.description ?? null,
          isRecurring: data.isRecurring,
          isActive: data.isActive,
        })
        .where(and(eq(feeHeads.id, data.id), eq(feeHeads.tenantId, tid)))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(feeHeads)
      .values({
        tenantId: tid,
        name: data.name,
        code: data.code ?? null,
        description: data.description ?? null,
        isRecurring: data.isRecurring,
        isActive: data.isActive,
      })
      .returning();
    return row;
  });

export const deleteFeeHead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeHeads } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(feeHeads)
      .where(and(eq(feeHeads.id, data.id), eq(feeHeads.tenantId, tid)));
    return { ok: true };
  });

/* ================== FEE STRUCTURES ================== */
export const listFeeStructures = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        academicYearId: z.string().uuid().optional(),
        classId: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeStructures, feeHeads, classes } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(feeStructures.tenantId, tid)];
    if (data.academicYearId)
      conds.push(eq(feeStructures.academicYearId, data.academicYearId));
    if (data.classId) conds.push(eq(feeStructures.classId, data.classId));
    return db
      .select({
        id: feeStructures.id,
        academicYearId: feeStructures.academicYearId,
        classId: feeStructures.classId,
        feeHeadId: feeStructures.feeHeadId,
        amount: feeStructures.amount,
        term: feeStructures.term,
        dueDay: feeStructures.dueDay,
        className: classes.name,
        feeHeadName: feeHeads.name,
      })
      .from(feeStructures)
      .leftJoin(feeHeads, eq(feeHeads.id, feeStructures.feeHeadId))
      .leftJoin(classes, eq(classes.id, feeStructures.classId))
      .where(and(...conds))
      .orderBy(desc(feeStructures.createdAt));
  });

const upsertStruct = z.object({
  id: z.string().uuid().optional(),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  feeHeadId: z.string().uuid(),
  amount: z.number().int().min(0),
  term: z.string().max(60).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});

export const saveFeeStructure = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => upsertStruct.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeStructures } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      const [row] = await db
        .update(feeStructures)
        .set({
          academicYearId: data.academicYearId,
          classId: data.classId,
          feeHeadId: data.feeHeadId,
          amount: data.amount,
          term: data.term ?? null,
          dueDay: data.dueDay ?? null,
        })
        .where(
          and(eq(feeStructures.id, data.id), eq(feeStructures.tenantId, tid)),
        )
        .returning();
      return row;
    }
    const [row] = await db
      .insert(feeStructures)
      .values({
        tenantId: tid,
        academicYearId: data.academicYearId,
        classId: data.classId,
        feeHeadId: data.feeHeadId,
        amount: data.amount,
        term: data.term ?? null,
        dueDay: data.dueDay ?? null,
      })
      .returning();
    return row;
  });

export const deleteFeeStructure = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeStructures } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(feeStructures)
      .where(
        and(eq(feeStructures.id, data.id), eq(feeStructures.tenantId, tid)),
      );
    return { ok: true };
  });

/* ================== INVOICES ================== */

async function nextInvoiceNo(db: any, tid: string): Promise<string> {
  const { feeInvoices } = await import("@/db/schema");
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(feeInvoices)
    .where(eq(feeInvoices.tenantId, tid));
  const seq = (row?.n ?? 0) + 1;
  const yr = new Date().getFullYear();
  return `INV-${yr}-${String(seq).padStart(5, "0")}`;
}

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid().optional(),
        status: z
          .enum(["unpaid", "partial", "paid", "cancelled"])
          .optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeInvoices, students } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(feeInvoices.tenantId, tid)];
    if (data.studentId) conds.push(eq(feeInvoices.studentId, data.studentId));
    if (data.status) conds.push(eq(feeInvoices.status, data.status));
    const where = and(...conds);

    const [tot] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(feeInvoices)
      .where(where);

    const rows = await db
      .select({
        id: feeInvoices.id,
        invoiceNo: feeInvoices.invoiceNo,
        studentId: feeInvoices.studentId,
        issueDate: feeInvoices.issueDate,
        dueDate: feeInvoices.dueDate,
        totalAmount: feeInvoices.totalAmount,
        paidAmount: feeInvoices.paidAmount,
        status: feeInvoices.status,
        studentFirst: students.firstName,
        studentLast: students.lastName,
        admissionNo: students.admissionNo,
      })
      .from(feeInvoices)
      .leftJoin(students, eq(students.id, feeInvoices.studentId))
      .where(where)
      .orderBy(desc(feeInvoices.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);

    return { rows, total: tot?.n ?? 0 };
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeInvoices, feeInvoiceItems, feePayments, students } =
      await import("@/db/schema");
    const db = getDb();
    const [inv] = await db
      .select()
      .from(feeInvoices)
      .where(and(eq(feeInvoices.id, data.id), eq(feeInvoices.tenantId, tid)));
    if (!inv) throw new Response("Not found", { status: 404 });
    const [stu] = await db
      .select()
      .from(students)
      .where(eq(students.id, inv.studentId));
    const items = await db
      .select()
      .from(feeInvoiceItems)
      .where(eq(feeInvoiceItems.invoiceId, inv.id));
    const payments = await db
      .select()
      .from(feePayments)
      .where(eq(feePayments.invoiceId, inv.id))
      .orderBy(desc(feePayments.createdAt));
    return { invoice: inv, student: stu, items, payments };
  });

const createInvoiceInput = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid().optional().nullable(),
  issueDate: z.string(),
  dueDate: z.string(),
  notes: z.string().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        feeHeadId: z.string().uuid().optional().nullable(),
        description: z.string().min(1).max(200),
        amount: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => createInvoiceInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeInvoices, feeInvoiceItems } = await import("@/db/schema");
    const db = getDb();
    const total = data.items.reduce((s, it) => s + it.amount, 0);
    const invoiceNo = await nextInvoiceNo(db, tid);
    const [inv] = await db
      .insert(feeInvoices)
      .values({
        tenantId: tid,
        invoiceNo,
        studentId: data.studentId,
        academicYearId: data.academicYearId ?? null,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        totalAmount: total,
        paidAmount: 0,
        status: "unpaid",
        notes: data.notes ?? null,
      })
      .returning();
    if (data.items.length > 0) {
      await db.insert(feeInvoiceItems).values(
        data.items.map((it) => ({
          tenantId: tid,
          invoiceId: inv.id,
          feeHeadId: it.feeHeadId ?? null,
          description: it.description,
          amount: it.amount,
        })),
      );
    }
    return inv;
  });

export const cancelInvoice = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeInvoices } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(feeInvoices)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(feeInvoices.id, data.id), eq(feeInvoices.tenantId, tid)));
    return { ok: true };
  });

/* ================== PAYMENTS ================== */
const recordPaymentInput = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().int().min(1),
  method: z.enum(["cash", "bank", "upi", "card", "cheque", "online", "other"]),
  reference: z.string().max(120).optional().nullable(),
  paidOn: z.string(),
  remarks: z.string().max(300).optional().nullable(),
  postToAccountHeadId: z.string().uuid().optional().nullable(),
});

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => recordPaymentInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const {
      feeInvoices,
      feePayments,
      accountTransactions,
    } = await import("@/db/schema");
    const db = getDb();
    const [inv] = await db
      .select()
      .from(feeInvoices)
      .where(
        and(eq(feeInvoices.id, data.invoiceId), eq(feeInvoices.tenantId, tid)),
      );
    if (!inv) throw new Response("Invoice not found", { status: 404 });
    if (inv.status === "cancelled")
      throw new Response("Invoice is cancelled", { status: 400 });

    const [pay] = await db
      .insert(feePayments)
      .values({
        tenantId: tid,
        invoiceId: inv.id,
        amount: data.amount,
        method: data.method,
        reference: data.reference ?? null,
        paidOn: data.paidOn,
        remarks: data.remarks ?? null,
      })
      .returning();

    const newPaid = inv.paidAmount + data.amount;
    const status =
      newPaid >= inv.totalAmount
        ? "paid"
        : newPaid > 0
          ? "partial"
          : "unpaid";
    await db
      .update(feeInvoices)
      .set({ paidAmount: newPaid, status, updatedAt: new Date() })
      .where(eq(feeInvoices.id, inv.id));

    if (data.postToAccountHeadId) {
      await db.insert(accountTransactions).values({
        tenantId: tid,
        accountHeadId: data.postToAccountHeadId,
        kind: "income",
        txDate: data.paidOn,
        amount: data.amount,
        description: `Fee payment ${inv.invoiceNo}`,
        reference: data.reference ?? null,
        feePaymentId: pay.id,
      });
    }
    return pay;
  });

export const cancelPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feePayments, feeInvoices } = await import("@/db/schema");
    const db = getDb();
    const [pay] = await db
      .select()
      .from(feePayments)
      .where(and(eq(feePayments.id, data.id), eq(feePayments.tenantId, tid)));
    if (!pay) throw new Response("Not found", { status: 404 });
    if (pay.isCancelled) return { ok: true };
    await db
      .update(feePayments)
      .set({ isCancelled: true })
      .where(eq(feePayments.id, pay.id));
    const [inv] = await db
      .select()
      .from(feeInvoices)
      .where(eq(feeInvoices.id, pay.invoiceId));
    if (inv) {
      const newPaid = Math.max(0, inv.paidAmount - pay.amount);
      const status =
        newPaid >= inv.totalAmount
          ? "paid"
          : newPaid > 0
            ? "partial"
            : "unpaid";
      await db
        .update(feeInvoices)
        .set({ paidAmount: newPaid, status, updatedAt: new Date() })
        .where(eq(feeInvoices.id, inv.id));
    }
    return { ok: true };
  });

/* ================== BULK GENERATE ================== */
export const generateInvoicesFromStructure = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        academicYearId: z.string().uuid(),
        classId: z.string().uuid(),
        term: z.string().optional().nullable(),
        issueDate: z.string(),
        dueDate: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const {
      feeStructures,
      feeHeads,
      students,
      feeInvoices,
      feeInvoiceItems,
    } = await import("@/db/schema");
    const db = getDb();

    const structConds = [
      eq(feeStructures.tenantId, tid),
      eq(feeStructures.academicYearId, data.academicYearId),
      eq(feeStructures.classId, data.classId),
    ];
    const structs = await db
      .select({
        id: feeStructures.id,
        amount: feeStructures.amount,
        term: feeStructures.term,
        feeHeadId: feeStructures.feeHeadId,
        headName: feeHeads.name,
      })
      .from(feeStructures)
      .leftJoin(feeHeads, eq(feeHeads.id, feeStructures.feeHeadId))
      .where(and(...structConds));

    const applicable = data.term
      ? structs.filter((s) => s.term === data.term)
      : structs;
    if (applicable.length === 0)
      return { created: 0, skipped: 0, message: "No fee structure found" };

    const kids = await db
      .select()
      .from(students)
      .where(
        and(
          eq(students.tenantId, tid),
          eq(students.classId, data.classId),
          eq(students.isActive, true),
        ),
      );
    if (kids.length === 0)
      return { created: 0, skipped: 0, message: "No active students" };

    const total = applicable.reduce((s, it) => s + it.amount, 0);
    let created = 0;
    for (const stu of kids) {
      const invoiceNo = await nextInvoiceNo(db, tid);
      const [inv] = await db
        .insert(feeInvoices)
        .values({
          tenantId: tid,
          invoiceNo,
          studentId: stu.id,
          academicYearId: data.academicYearId,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          totalAmount: total,
          paidAmount: 0,
          status: "unpaid",
        })
        .returning();
      await db.insert(feeInvoiceItems).values(
        applicable.map((s) => ({
          tenantId: tid,
          invoiceId: inv.id,
          feeHeadId: s.feeHeadId,
          description: s.headName ?? "Fee",
          amount: s.amount,
        })),
      );
      created++;
    }
    return { created, skipped: 0 };
  });

/* ================== DUE REPORT ================== */
export const dueReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        classId: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { feeInvoices, students } = await import("@/db/schema");
    const db = getDb();
    const rows = await db
      .select({
        studentId: students.id,
        first: students.firstName,
        last: students.lastName,
        admissionNo: students.admissionNo,
        classId: students.classId,
        invoices: sql<number>`count(${feeInvoices.id})::int`,
        totalDue: sql<number>`coalesce(sum(${feeInvoices.totalAmount} - ${feeInvoices.paidAmount}),0)::int`,
      })
      .from(students)
      .leftJoin(
        feeInvoices,
        and(
          eq(feeInvoices.studentId, students.id),
          inArray(feeInvoices.status, ["unpaid", "partial"]),
        ),
      )
      .where(
        and(
          eq(students.tenantId, tid),
          data.classId ? eq(students.classId, data.classId) : sql`true`,
        ),
      )
      .groupBy(students.id)
      .orderBy(desc(sql`coalesce(sum(${feeInvoices.totalAmount} - ${feeInvoices.paidAmount}),0)`));
    return rows.filter((r) => r.totalDue > 0);
  });
