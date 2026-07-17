/**
 * Academic Calendar — events CRUD and monthly view.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { calendarEvents } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(calendarEvents.tenantId, tid)];
    if (data.from) conds.push(gte(calendarEvents.endDate, data.from));
    if (data.to) conds.push(lte(calendarEvents.startDate, data.to));
    return db
      .select()
      .from(calendarEvents)
      .where(and(...conds))
      .orderBy(desc(calendarEvents.startDate));
  });

const eventUpsert = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isAllDay: z.boolean().default(true),
  type: z
    .enum(["holiday", "exam", "event", "meeting", "other"])
    .default("event"),
  color: z.string().max(20).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

export const saveEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => eventUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { calendarEvents } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(calendarEvents)
        .set({
          title: data.title,
          description: data.description ?? null,
          startDate: data.startDate,
          endDate: data.endDate,
          isAllDay: data.isAllDay,
          type: data.type,
          color: data.color ?? null,
          location: data.location ?? null,
        })
        .where(
          and(
            eq(calendarEvents.id, data.id),
            eq(calendarEvents.tenantId, tid),
          ),
        );
      return { id: data.id };
    }
    const [row] = await db
      .insert(calendarEvents)
      .values({
        tenantId: tid,
        title: data.title,
        description: data.description ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        isAllDay: data.isAllDay,
        type: data.type,
        color: data.color ?? null,
        location: data.location ?? null,
        createdBy: context.userId ?? null,
      })
      .returning({ id: calendarEvents.id });
    return { id: row.id };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { calendarEvents } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(calendarEvents)
      .where(
        and(eq(calendarEvents.id, data.id), eq(calendarEvents.tenantId, tid)),
      );
    return { ok: true };
  });
