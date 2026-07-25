/**
 * Library — books, issues, returns, fines.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireAccess } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ================== BOOKS ================== */
export const listBooks = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "library.read" })])
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { books } = await import("@/db/schema");
    const db = getDb();
    const conds = [eq(books.tenantId, tid)];
    if (data.q) {
      conds.push(
        sql`(${books.title} ILIKE ${"%" + data.q + "%"} OR ${books.author} ILIKE ${"%" + data.q + "%"} OR ${books.isbn} ILIKE ${"%" + data.q + "%"})`,
      );
    }
    return db
      .select()
      .from(books)
      .where(and(...conds))
      .orderBy(desc(books.createdAt));
  });

const bookUpsert = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  author: z.string().max(120).optional().nullable(),
  isbn: z.string().max(40).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  publisher: z.string().max(120).optional().nullable(),
  edition: z.string().max(40).optional().nullable(),
  totalCopies: z.number().int().positive().default(1),
  availableCopies: z.number().int().nonnegative().default(1),
  rackNo: z.string().max(40).optional().nullable(),
  dailyFine: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const saveBook = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["library.create", "library.update", "library.delete"] })])
  .inputValidator((d: unknown) => bookUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { books } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(books)
        .set({
          title: data.title,
          author: data.author ?? null,
          isbn: data.isbn ?? null,
          category: data.category ?? null,
          publisher: data.publisher ?? null,
          edition: data.edition ?? null,
          totalCopies: data.totalCopies,
          availableCopies: data.availableCopies,
          rackNo: data.rackNo ?? null,
          dailyFine: data.dailyFine,
          isActive: data.isActive,
        })
        .where(and(eq(books.id, data.id), eq(books.tenantId, tid)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(books)
      .values({
        tenantId: tid,
        title: data.title,
        author: data.author ?? null,
        isbn: data.isbn ?? null,
        category: data.category ?? null,
        publisher: data.publisher ?? null,
        edition: data.edition ?? null,
        totalCopies: data.totalCopies,
        availableCopies: data.availableCopies,
        rackNo: data.rackNo ?? null,
        dailyFine: data.dailyFine,
        isActive: data.isActive,
      })
      .returning({ id: books.id });
    return { id: row.id };
  });

export const deleteBook = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["library.create", "library.update", "library.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { books } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(books)
      .where(and(eq(books.id, data.id), eq(books.tenantId, tid)));
    return { ok: true };
  });

/* ================== ISSUES ================== */
export const listIssues = createServerFn({ method: "GET" })
  .middleware([requireAccess({ plan: "pro", perm: "library.read" })])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["issued", "returned", "overdue", "lost", "all"]).default(
          "issued",
        ),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { bookIssues, books, students, employees } = await import(
      "@/db/schema"
    );
    const db = getDb();
    const conds = [eq(bookIssues.tenantId, tid)];
    if (data.status !== "all") conds.push(eq(bookIssues.status, data.status));
    return db
      .select({
        id: bookIssues.id,
        bookId: bookIssues.bookId,
        bookTitle: books.title,
        borrowerType: bookIssues.borrowerType,
        studentId: bookIssues.studentId,
        employeeId: bookIssues.employeeId,
        borrowerName: sql<string>`COALESCE(
          ${students.firstName} || ' ' || COALESCE(${students.lastName},''),
          ${employees.firstName} || ' ' || COALESCE(${employees.lastName},'')
        )`,
        issuedOn: bookIssues.issuedOn,
        dueDate: bookIssues.dueDate,
        returnedOn: bookIssues.returnedOn,
        fineAmount: bookIssues.fineAmount,
        fineCollected: bookIssues.fineCollected,
        status: bookIssues.status,
      })
      .from(bookIssues)
      .innerJoin(books, eq(books.id, bookIssues.bookId))
      .leftJoin(students, eq(students.id, bookIssues.studentId))
      .leftJoin(employees, eq(employees.id, bookIssues.employeeId))
      .where(and(...conds))
      .orderBy(desc(bookIssues.createdAt));
  });

const issueSchema = z.object({
  bookId: z.string().uuid(),
  borrowerType: z.enum(["student", "employee"]),
  studentId: z.string().uuid().optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  issuedOn: z.string().min(1),
  dueDate: z.string().min(1),
  note: z.string().max(300).optional().nullable(),
});

export const issueBook = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["library.create", "library.update", "library.delete"] })])
  .inputValidator((d: unknown) => issueSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { books, bookIssues } = await import("@/db/schema");
    const db = getDb();
    const [book] = await db
      .select({ available: books.availableCopies })
      .from(books)
      .where(and(eq(books.id, data.bookId), eq(books.tenantId, tid)));
    if (!book) throw new Response("Book not found", { status: 404 });
    if (book.available <= 0)
      throw new Response("No copies available", { status: 400 });
    if (data.borrowerType === "student" && !data.studentId)
      throw new Response("Student required", { status: 400 });
    if (data.borrowerType === "employee" && !data.employeeId)
      throw new Response("Employee required", { status: 400 });
    const [row] = await db
      .insert(bookIssues)
      .values({
        tenantId: tid,
        bookId: data.bookId,
        borrowerType: data.borrowerType,
        studentId: data.borrowerType === "student" ? data.studentId! : null,
        employeeId: data.borrowerType === "employee" ? data.employeeId! : null,
        issuedOn: data.issuedOn,
        dueDate: data.dueDate,
        status: "issued",
        note: data.note ?? null,
      })
      .returning({ id: bookIssues.id });
    await db
      .update(books)
      .set({ availableCopies: book.available - 1 })
      .where(and(eq(books.id, data.bookId), eq(books.tenantId, tid)));
    return { id: row.id };
  });

const returnSchema = z.object({
  id: z.string().uuid(),
  returnedOn: z.string().min(1),
  fineCollected: z.number().int().nonnegative().default(0),
  lost: z.boolean().default(false),
});

export const returnBook = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["library.create", "library.update", "library.delete"] })])
  .inputValidator((d: unknown) => returnSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { books, bookIssues } = await import("@/db/schema");
    const db = getDb();
    const [issue] = await db
      .select()
      .from(bookIssues)
      .where(and(eq(bookIssues.id, data.id), eq(bookIssues.tenantId, tid)));
    if (!issue) throw new Response("Issue not found", { status: 404 });
    if (issue.status !== "issued" && issue.status !== "overdue")
      throw new Response("Already closed", { status: 400 });
    // compute fine
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, issue.bookId));
    let fine = 0;
    if (book && book.dailyFine > 0) {
      const due = new Date(issue.dueDate);
      const ret = new Date(data.returnedOn);
      const days = Math.max(
        0,
        Math.floor((ret.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)),
      );
      fine = days * book.dailyFine;
    }
    await db
      .update(bookIssues)
      .set({
        returnedOn: data.returnedOn,
        fineAmount: fine,
        fineCollected: data.fineCollected,
        status: data.lost ? "lost" : "returned",
      })
      .where(and(eq(bookIssues.id, data.id), eq(bookIssues.tenantId, tid)));
    // restore availability only if not lost
    if (!data.lost && book) {
      await db
        .update(books)
        .set({ availableCopies: book.availableCopies + 1 })
        .where(eq(books.id, book.id));
    }
    return { ok: true, fine };
  });

export const deleteIssue = createServerFn({ method: "POST" })
  .middleware([requireAccess({ plan: "pro", anyPerm: ["library.create", "library.update", "library.delete"] })])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { bookIssues } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(bookIssues)
      .where(and(eq(bookIssues.id, data.id), eq(bookIssues.tenantId, tid)));
    return { ok: true };
  });
