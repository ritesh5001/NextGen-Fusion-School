/**
 * Notice Board — CRUD and publishing.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listNotices = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { notices } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(notices)
      .where(eq(notices.tenantId, tid))
      .orderBy(desc(notices.isPinned), desc(notices.createdAt));
  });

const noticeUpsert = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  audience: z.string().max(40).default("all"),
  publishFrom: z.string().optional().nullable(),
  publishTo: z.string().optional().nullable(),
  isPinned: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

export const saveNotice = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => noticeUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { notices } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(notices)
        .set({
          title: data.title,
          body: data.body,
          audience: data.audience,
          publishFrom: data.publishFrom ?? null,
          publishTo: data.publishTo ?? null,
          isPinned: data.isPinned,
          isPublished: data.isPublished,
        })
        .where(and(eq(notices.id, data.id), eq(notices.tenantId, tid)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(notices)
      .values({
        tenantId: tid,
        title: data.title,
        body: data.body,
        audience: data.audience,
        publishFrom: data.publishFrom ?? null,
        publishTo: data.publishTo ?? null,
        isPinned: data.isPinned,
        isPublished: data.isPublished,
        createdBy: context.userId ?? null,
      })
      .returning({ id: notices.id });
    return { id: row.id };
  });

export const deleteNotice = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { notices } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(notices)
      .where(and(eq(notices.id, data.id), eq(notices.tenantId, tid)));
    return { ok: true };
  });
