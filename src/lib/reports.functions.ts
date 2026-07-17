/**
 * Reports — aggregated snapshots across modules.
 */
import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const getReportsSummary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const {
      students,
      teachers,
      employees,
      classes,
      sections,
      feeInvoices,
      feePayments,
      accountTransactions,
      bookIssues,
      hostelAllocations,
      admissionApplications,
    } = await import("@/db/schema");
    const db = getDb();

    const [studentCounts] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${students.isActive})::int`,
      })
      .from(students)
      .where(eq(students.tenantId, tid));

    const [teacherCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(teachers)
      .where(eq(teachers.tenantId, tid));

    const [empCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(employees)
      .where(eq(employees.tenantId, tid));

    const [classCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(classes)
      .where(eq(classes.tenantId, tid));

    const [sectionCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(sections)
      .where(eq(sections.tenantId, tid));

    const [invoiceAgg] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${feeInvoices.totalAmount}),0)::int`,
        paid: sql<number>`COALESCE(SUM(${feeInvoices.paidAmount}),0)::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(feeInvoices)
      .where(eq(feeInvoices.tenantId, tid));

    const [paymentAgg] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${feePayments.amount}),0)::int`,
      })
      .from(feePayments)
      .where(eq(feePayments.tenantId, tid));

    const [ledgerAgg] = await db
      .select({
        income: sql<number>`COALESCE(SUM(${accountTransactions.amount}) FILTER (WHERE ${accountTransactions.kind} = 'income'),0)::int`,
        expense: sql<number>`COALESCE(SUM(${accountTransactions.amount}) FILTER (WHERE ${accountTransactions.kind} = 'expense'),0)::int`,
      })
      .from(accountTransactions)
      .where(eq(accountTransactions.tenantId, tid));

    const [libraryAgg] = await db
      .select({
        issued: sql<number>`COUNT(*) FILTER (WHERE ${bookIssues.status} = 'issued')::int`,
        overdue: sql<number>`COUNT(*) FILTER (WHERE ${bookIssues.status} = 'overdue')::int`,
      })
      .from(bookIssues)
      .where(eq(bookIssues.tenantId, tid));

    const [hostelAgg] = await db
      .select({
        active: sql<number>`COUNT(*) FILTER (WHERE ${hostelAllocations.status} = 'active')::int`,
      })
      .from(hostelAllocations)
      .where(eq(hostelAllocations.tenantId, tid));

    const [admissionAgg] = await db
      .select({
        pending: sql<number>`COUNT(*) FILTER (WHERE ${admissionApplications.status} IN ('pending','under_review'))::int`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${admissionApplications.status} = 'approved')::int`,
      })
      .from(admissionApplications)
      .where(eq(admissionApplications.tenantId, tid));

    return {
      students: studentCounts,
      teachers: teacherCount.n,
      employees: empCount.n,
      classes: classCount.n,
      sections: sectionCount.n,
      fees: {
        billed: invoiceAgg.total,
        paid: invoiceAgg.paid,
        due: invoiceAgg.total - invoiceAgg.paid,
        invoices: invoiceAgg.count,
        collections: paymentAgg.total,
      },
      ledger: {
        income: ledgerAgg.income,
        expense: ledgerAgg.expense,
        net: ledgerAgg.income - ledgerAgg.expense,
      },
      library: libraryAgg,
      hostel: hostelAgg,
      admissions: admissionAgg,
    };
  });
