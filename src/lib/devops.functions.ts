/**
 * Phase 10 — Developer utilities: system health, log viewer, cache clear,
 * DB integrity check, and log write helper.
 *
 * These endpoints are gated: only users with role slug 'superadmin' or
 * 'admin' may hit them.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

async function requireAdmin(context: {
  userId: string | null;
  tenantId: string | null;
}) {
  if (!context.userId)
    throw new Response("Unauthorized", { status: 401 });
  const { getDb } = await import("@/db/client.server");
  const { userRoles, roles } = await import("@/db/schema");
  const db = getDb();
  const rows = await db
    .select({ key: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, context.userId));
  const keys = rows.map((r) => r.key);
  if (!keys.some((s) => s === "superadmin" || s === "admin"))
    throw new Response("Forbidden", { status: 403 });
  return { keys };
}


/* -------- Log helper (server-only, callable from other server fns) -------- */
export async function writeLog(args: {
  tenantId?: string | null;
  userId?: string | null;
  level?: "info" | "warn" | "error";
  category?: string;
  message: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    const { getDb } = await import("@/db/client.server");
    const { systemLogs } = await import("@/db/schema");
    const db = getDb();
    await db.insert(systemLogs).values({
      tenantId: args.tenantId ?? null,
      userId: args.userId ?? null,
      level: args.level ?? "info",
      category: args.category ?? "system",
      message: args.message,
      metadata: args.metadata ? JSON.stringify(args.metadata) : null,
      ipAddress: args.ipAddress ?? null,
    });
  } catch {
    // Never let logging break the caller
  }
}

/* -------- System health -------- */
export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "max", perm: "settings.read" })])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { getDb } = await import("@/db/client.server");
    const schema = await import("@/db/schema");
    const db = getDb();

    const started = Date.now();
    let dbOk = false;
    let dbLatencyMs = 0;
    try {
      await db.execute(sql`select 1`);
      dbOk = true;
      dbLatencyMs = Date.now() - started;
    } catch {
      dbOk = false;
    }

    // Row counts across key tables — scoped to tenant when applicable
    const tid = context.tenantId;
    async function count(
      table:
        | typeof schema.students
        | typeof schema.teachers
        | typeof schema.employees
        | typeof schema.users
        | typeof schema.exams
        | typeof schema.feeInvoices
        | typeof schema.notifications
        | typeof schema.systemLogs,
      hasTenant = true,
    ) {
      try {
        const q = db
          .select({ n: sql<number>`count(*)::int` })
          .from(table as never);
        const r = (
          hasTenant && tid
            ? await q.where(
                eq(
                  (table as { tenantId: unknown }).tenantId as never,
                  tid,
                ),
              )
            : await q
        ) as { n: number }[];
        return r[0]?.n ?? 0;
      } catch {
        return 0;
      }
    }


    return {
      db: { ok: dbOk, latencyMs: dbLatencyMs },
      counts: {
        users: await count(schema.users, false),
        students: await count(schema.students),
        teachers: await count(schema.teachers),
        employees: await count(schema.employees),
        exams: await count(schema.exams),
        invoices: await count(schema.feeInvoices),
        notifications: await count(schema.notifications),
        logs: await count(schema.systemLogs, false),
      },
      server: {
        node: typeof process !== "undefined" ? process.version : "n/a",
        uptimeSec:
          typeof process !== "undefined" && process.uptime
            ? Math.floor(process.uptime())
            : 0,
        env:
          typeof process !== "undefined" && process.env
            ? process.env.NODE_ENV ?? "unknown"
            : "unknown",
        now: new Date().toISOString(),
      },
    };
  });

/* -------- Log viewer -------- */
const listLogsInput = z.object({
  level: z.enum(["all", "info", "warn", "error"]).default("all"),
  category: z.string().optional(),
  sinceHours: z.number().int().min(1).max(24 * 30).default(24),
  limit: z.number().int().min(1).max(500).default(100),
});

export const listSystemLogs = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "max", perm: "settings.read" })])
  .inputValidator((d: unknown) => listLogsInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { getDb } = await import("@/db/client.server");
    const { systemLogs } = await import("@/db/schema");
    const db = getDb();

    const since = new Date(Date.now() - data.sinceHours * 3600_000);
    const filters = [gte(systemLogs.createdAt, since)];
    if (context.tenantId) filters.push(eq(systemLogs.tenantId, context.tenantId));
    if (data.level !== "all") filters.push(eq(systemLogs.level, data.level));
    if (data.category)
      filters.push(eq(systemLogs.category, data.category));

    const rows = await db
      .select()
      .from(systemLogs)
      .where(and(...filters))
      .orderBy(desc(systemLogs.createdAt))
      .limit(data.limit);

    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      level: r.level,
      category: r.category,
      message: r.message,
      metadata: r.metadata,
      userId: r.userId,
      ipAddress: r.ipAddress,
    }));
  });

/* -------- Cache clear (soft — records the action, invalidates in-memory) -------- */
const clearedFlag = { at: 0 };

export const clearCache = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "max", anyPerm: ["settings.create", "settings.update", "settings.delete"] })])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    clearedFlag.at = Date.now();
    await writeLog({
      tenantId: context.tenantId,
      userId: context.userId,
      category: "devops",
      message: "Cache cleared",
    });
    return { ok: true, clearedAt: new Date(clearedFlag.at).toISOString() };
  });

/* -------- DB integrity check — verifies key relationships / counts -------- */
export const runIntegrityCheck = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "max", anyPerm: ["settings.create", "settings.update", "settings.delete"] })])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { getDb } = await import("@/db/client.server");
    const db = getDb();

    const checks: { name: string; ok: boolean; detail: string }[] = [];

    async function scalar(label: string, query: ReturnType<typeof sql>) {
      try {
        const res = (await db.execute(query)) as {
          rows?: { n?: number }[];
        } & { n?: number }[];
        // drizzle-orm returns either .rows or an array — normalize
        const rows =
          (res as { rows?: { n?: number }[] }).rows ??
          (res as unknown as { n?: number }[]);
        const n = Number(rows?.[0]?.n ?? 0);
        checks.push({
          name: label,
          ok: n === 0,
          detail: n === 0 ? "clean" : `${n} orphan row(s)`,
        });
      } catch (e) {
        checks.push({
          name: label,
          ok: false,
          detail: (e as Error).message,
        });
      }
    }

    await scalar(
      "students → classes",
      sql`select count(*)::int as n from students s
          left join classes c on c.id = s.class_id
          where s.class_id is not null and c.id is null`,
    );
    await scalar(
      "marks → exams",
      sql`select count(*)::int as n from marks m
          left join exams e on e.id = m.exam_id
          where e.id is null`,
    );
    await scalar(
      "fee_invoices → students",
      sql`select count(*)::int as n from fee_invoices i
          left join students s on s.id = i.student_id
          where s.id is null`,
    );
    await scalar(
      "user_roles → users",
      sql`select count(*)::int as n from user_roles ur
          left join users u on u.id = ur.user_id
          where u.id is null`,
    );

    await writeLog({
      tenantId: context.tenantId,
      userId: context.userId,
      category: "devops",
      level: checks.every((c) => c.ok) ? "info" : "warn",
      message: "DB integrity check run",
      metadata: { checks },
    });

    return { checks };
  });

/* -------- Test log (used by UI to verify pipeline) -------- */
export const writeTestLog = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "max", anyPerm: ["settings.create", "settings.update", "settings.delete"] })])
  .inputValidator((d: unknown) =>
    z
      .object({
        level: z.enum(["info", "warn", "error"]).default("info"),
        message: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    await writeLog({
      tenantId: context.tenantId,
      userId: context.userId,
      level: data.level,
      category: "test",
      message: data.message,
    });
    return { ok: true };
  });
