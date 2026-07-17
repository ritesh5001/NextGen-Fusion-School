/**
 * Hostel — hostels, rooms, allocations, vacate flow.
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

/* ================== HOSTELS ================== */
export const listHostels = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostels } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(hostels)
      .where(eq(hostels.tenantId, tid))
      .orderBy(desc(hostels.createdAt));
  });

const hostelUpsert = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  type: z.enum(["boys", "girls", "mixed"]).default("boys"),
  address: z.string().max(300).optional().nullable(),
  wardenName: z.string().max(120).optional().nullable(),
  wardenPhone: z.string().max(30).optional().nullable(),
  capacity: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const saveHostel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => hostelUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostels } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(hostels)
        .set({
          name: data.name,
          type: data.type,
          address: data.address ?? null,
          wardenName: data.wardenName ?? null,
          wardenPhone: data.wardenPhone ?? null,
          capacity: data.capacity,
          isActive: data.isActive,
        })
        .where(and(eq(hostels.id, data.id), eq(hostels.tenantId, tid)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(hostels)
      .values({
        tenantId: tid,
        name: data.name,
        type: data.type,
        address: data.address ?? null,
        wardenName: data.wardenName ?? null,
        wardenPhone: data.wardenPhone ?? null,
        capacity: data.capacity,
        isActive: data.isActive,
      })
      .returning({ id: hostels.id });
    return { id: row.id };
  });

export const deleteHostel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostels } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(hostels)
      .where(and(eq(hostels.id, data.id), eq(hostels.tenantId, tid)));
    return { ok: true };
  });

/* ================== ROOMS ================== */
export const listRooms = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ hostelId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostelRooms, hostelAllocations } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(hostelRooms.tenantId, tid)];
    if (data.hostelId) conds.push(eq(hostelRooms.hostelId, data.hostelId));
    const rows = await db
      .select({
        id: hostelRooms.id,
        hostelId: hostelRooms.hostelId,
        roomNo: hostelRooms.roomNo,
        floor: hostelRooms.floor,
        capacity: hostelRooms.capacity,
        monthlyRent: hostelRooms.monthlyRent,
        isActive: hostelRooms.isActive,
        occupied: sql<number>`(
          SELECT COUNT(*)::int FROM ${hostelAllocations}
          WHERE ${hostelAllocations.roomId} = ${hostelRooms.id}
            AND ${hostelAllocations.status} = 'active'
        )`,
      })
      .from(hostelRooms)
      .where(and(...conds))
      .orderBy(hostelRooms.roomNo);
    return rows;
  });

const roomUpsert = z.object({
  id: z.string().uuid().optional(),
  hostelId: z.string().uuid(),
  roomNo: z.string().min(1).max(40),
  floor: z.string().max(40).optional().nullable(),
  capacity: z.number().int().positive().default(1),
  monthlyRent: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const saveRoom = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => roomUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostelRooms } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(hostelRooms)
        .set({
          hostelId: data.hostelId,
          roomNo: data.roomNo,
          floor: data.floor ?? null,
          capacity: data.capacity,
          monthlyRent: data.monthlyRent,
          isActive: data.isActive,
        })
        .where(and(eq(hostelRooms.id, data.id), eq(hostelRooms.tenantId, tid)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(hostelRooms)
      .values({
        tenantId: tid,
        hostelId: data.hostelId,
        roomNo: data.roomNo,
        floor: data.floor ?? null,
        capacity: data.capacity,
        monthlyRent: data.monthlyRent,
        isActive: data.isActive,
      })
      .returning({ id: hostelRooms.id });
    return { id: row.id };
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostelRooms } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(hostelRooms)
      .where(and(eq(hostelRooms.id, data.id), eq(hostelRooms.tenantId, tid)));
    return { ok: true };
  });

/* ================== ALLOCATIONS ================== */
export const listAllocations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        hostelId: z.string().uuid().optional(),
        status: z.enum(["active", "vacated", "all"]).default("active"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostelAllocations, hostelRooms, hostels, students } = await import(
      "@/db/schema"
    );
    const db = getDb();
    const conds = [eq(hostelAllocations.tenantId, tid)];
    if (data.status !== "all")
      conds.push(eq(hostelAllocations.status, data.status));
    if (data.hostelId) conds.push(eq(hostelRooms.hostelId, data.hostelId));
    return db
      .select({
        id: hostelAllocations.id,
        roomId: hostelAllocations.roomId,
        studentId: hostelAllocations.studentId,
        allocatedOn: hostelAllocations.allocatedOn,
        vacatedOn: hostelAllocations.vacatedOn,
        status: hostelAllocations.status,
        note: hostelAllocations.note,
        roomNo: hostelRooms.roomNo,
        hostelName: hostels.name,
        studentName: sql<string>`(${students.firstName} || ' ' || COALESCE(${students.lastName},''))`,
        admissionNo: students.admissionNo,
      })
      .from(hostelAllocations)
      .innerJoin(hostelRooms, eq(hostelRooms.id, hostelAllocations.roomId))
      .innerJoin(hostels, eq(hostels.id, hostelRooms.hostelId))
      .innerJoin(students, eq(students.id, hostelAllocations.studentId))
      .where(and(...conds))
      .orderBy(desc(hostelAllocations.createdAt));
  });

const allocateSchema = z.object({
  roomId: z.string().uuid(),
  studentId: z.string().uuid(),
  allocatedOn: z.string().min(1),
  note: z.string().max(300).optional().nullable(),
});

export const allocateRoom = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => allocateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostelAllocations, hostelRooms } = await import("@/db/schema");
    const db = getDb();
    // capacity check
    const [room] = await db
      .select({ capacity: hostelRooms.capacity })
      .from(hostelRooms)
      .where(and(eq(hostelRooms.id, data.roomId), eq(hostelRooms.tenantId, tid)));
    if (!room) throw new Response("Room not found", { status: 404 });
    const [{ occupied }] = await db
      .select({
        occupied: sql<number>`COUNT(*)::int`,
      })
      .from(hostelAllocations)
      .where(
        and(
          eq(hostelAllocations.roomId, data.roomId),
          eq(hostelAllocations.status, "active"),
        ),
      );
    if (occupied >= room.capacity)
      throw new Response("Room is full", { status: 400 });
    // ensure student not already active
    const existing = await db
      .select({ id: hostelAllocations.id })
      .from(hostelAllocations)
      .where(
        and(
          eq(hostelAllocations.studentId, data.studentId),
          eq(hostelAllocations.status, "active"),
        ),
      );
    if (existing.length)
      throw new Response("Student already allocated to a room", {
        status: 400,
      });
    const [row] = await db
      .insert(hostelAllocations)
      .values({
        tenantId: tid,
        roomId: data.roomId,
        studentId: data.studentId,
        allocatedOn: data.allocatedOn,
        note: data.note ?? null,
        status: "active",
      })
      .returning({ id: hostelAllocations.id });
    return { id: row.id };
  });

export const vacateAllocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), vacatedOn: z.string().min(1) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostelAllocations } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(hostelAllocations)
      .set({ status: "vacated", vacatedOn: data.vacatedOn })
      .where(
        and(
          eq(hostelAllocations.id, data.id),
          eq(hostelAllocations.tenantId, tid),
        ),
      );
    return { ok: true };
  });

export const deleteAllocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { hostelAllocations } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(hostelAllocations)
      .where(
        and(
          eq(hostelAllocations.id, data.id),
          eq(hostelAllocations.tenantId, tid),
        ),
      );
    return { ok: true };
  });
