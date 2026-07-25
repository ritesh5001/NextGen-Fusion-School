/**
 * Accounts — heads (income/expense), transactions, ledger (tenant scoped).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, sql, gte, lte } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listAccountHeads = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "accounts.read" })])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { accountHeads } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(accountHeads)
      .where(eq(accountHeads.tenantId, tid))
      .orderBy(accountHeads.name);
  });

const upsertHead = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  kind: z.enum(["income", "expense"]),
  description: z.string().max(300).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const saveAccountHead = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["accounts.create", "accounts.update", "accounts.delete"] })])
  .inputValidator((d: unknown) => upsertHead.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { accountHeads } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      const [row] = await db
        .update(accountHeads)
        .set({
          name: data.name,
          kind: data.kind,
          description: data.description ?? null,
          isActive: data.isActive,
        })
        .where(and(eq(accountHeads.id, data.id), eq(accountHeads.tenantId, tid)))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(accountHeads)
      .values({
        tenantId: tid,
        name: data.name,
        kind: data.kind,
        description: data.description ?? null,
        isActive: data.isActive,
      })
      .returning();
    return row;
  });

export const deleteAccountHead = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["accounts.create", "accounts.update", "accounts.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { accountHeads } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(accountHeads)
      .where(and(eq(accountHeads.id, data.id), eq(accountHeads.tenantId, tid)));
    return { ok: true };
  });

/* ================== TRANSACTIONS / LEDGER ================== */
const txInput = z.object({
  id: z.string().uuid().optional(),
  accountHeadId: z.string().uuid(),
  kind: z.enum(["income", "expense"]),
  txDate: z.string(),
  amount: z.number().int().min(1),
  description: z.string().max(300).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
});

export const saveTransaction = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["accounts.create", "accounts.update", "accounts.delete"] })])
  .inputValidator((d: unknown) => txInput.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { accountTransactions } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      const [row] = await db
        .update(accountTransactions)
        .set({
          accountHeadId: data.accountHeadId,
          kind: data.kind,
          txDate: data.txDate,
          amount: data.amount,
          description: data.description ?? null,
          reference: data.reference ?? null,
        })
        .where(
          and(
            eq(accountTransactions.id, data.id),
            eq(accountTransactions.tenantId, tid),
          ),
        )
        .returning();
      return row;
    }
    const [row] = await db
      .insert(accountTransactions)
      .values({
        tenantId: tid,
        accountHeadId: data.accountHeadId,
        kind: data.kind,
        txDate: data.txDate,
        amount: data.amount,
        description: data.description ?? null,
        reference: data.reference ?? null,
      })
      .returning();
    return row;
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["accounts.create", "accounts.update", "accounts.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { accountTransactions } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(accountTransactions)
      .where(
        and(
          eq(accountTransactions.id, data.id),
          eq(accountTransactions.tenantId, tid),
        ),
      );
    return { ok: true };
  });

export const ledger = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "accounts.read" })])
  .inputValidator((d: unknown) =>
    z
      .object({
        accountHeadId: z.string().uuid().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { accountTransactions, accountHeads } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(accountTransactions.tenantId, tid)];
    if (data.accountHeadId)
      conds.push(eq(accountTransactions.accountHeadId, data.accountHeadId));
    if (data.from) conds.push(gte(accountTransactions.txDate, data.from));
    if (data.to) conds.push(lte(accountTransactions.txDate, data.to));
    const rows = await db
      .select({
        id: accountTransactions.id,
        txDate: accountTransactions.txDate,
        kind: accountTransactions.kind,
        amount: accountTransactions.amount,
        description: accountTransactions.description,
        reference: accountTransactions.reference,
        accountHeadId: accountTransactions.accountHeadId,
        headName: accountHeads.name,
      })
      .from(accountTransactions)
      .leftJoin(
        accountHeads,
        eq(accountHeads.id, accountTransactions.accountHeadId),
      )
      .where(and(...conds))
      .orderBy(desc(accountTransactions.txDate));

    const [tot] = await db
      .select({
        income: sql<number>`coalesce(sum(case when ${accountTransactions.kind}='income' then ${accountTransactions.amount} else 0 end),0)::int`,
        expense: sql<number>`coalesce(sum(case when ${accountTransactions.kind}='expense' then ${accountTransactions.amount} else 0 end),0)::int`,
      })
      .from(accountTransactions)
      .where(and(...conds));

    return {
      rows,
      totals: {
        income: tot?.income ?? 0,
        expense: tot?.expense ?? 0,
        net: (tot?.income ?? 0) - (tot?.expense ?? 0),
      },
    };
  });
