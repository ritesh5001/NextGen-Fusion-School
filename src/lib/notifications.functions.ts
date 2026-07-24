/**
 * Notifications — in-app inbox.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { requirePlan } from "./auth-middleware.server";

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requirePlan("pro")])
  .inputValidator((d: unknown) =>
    z
      .object({
        filter: z.enum(["all", "unread"]).default("all"),
        limit: z.number().int().positive().max(200).default(50),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/db/client.server");
    const { notifications } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(notifications.userId, context.userId)];
    if (data.filter === "unread")
      conds.push(eq(notifications.isRead, false));
    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conds))
      .orderBy(desc(notifications.createdAt))
      .limit(data.limit);
    const [{ unread }] = await db
      .select({ unread: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, context.userId),
          eq(notifications.isRead, false),
        ),
      );
    return { rows, unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requirePlan("pro")])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), isRead: z.boolean().default(true) }).parse(
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/db/client.server");
    const { notifications } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(notifications)
      .set({ isRead: data.isRead })
      .where(
        and(
          eq(notifications.id, data.id),
          eq(notifications.userId, context.userId),
        ),
      );
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requirePlan("pro")])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/db/client.server");
    const { notifications } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, context.userId),
          eq(notifications.isRead, false),
        ),
      );
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requirePlan("pro")])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/db/client.server");
    const { notifications } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, data.id),
          eq(notifications.userId, context.userId),
        ),
      );
    return { ok: true };
  });

/** Server-side helper to enqueue a notification (importable from other .server code). */
export async function createNotification(input: {
  tenantId: string;
  userId: string;
  title: string;
  body?: string | null;
  link?: string | null;
  category?: string;
}) {
  const { getDb } = await import("@/db/client.server");
  const { notifications } = await import("@/db/schema");
  const db = getDb();
  await db.insert(notifications).values({
    tenantId: input.tenantId,
    userId: input.userId,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    category: input.category ?? "general",
  });
}
