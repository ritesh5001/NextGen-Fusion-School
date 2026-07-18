/**
 * Student Self-Portal — the logged-in student (linked via users.id -> students.userId)
 * fetches their own profile, attendance summary, results, and fee status.
 * Also exposes a public teacher profile fetcher.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, sql, asc } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

export const getMyStudentProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/db/client.server");
    const {
      students,
      classes,
      sections,
      academicYears,
      studentAttendance,
      feeInvoices,
    } = await import("@/db/schema");
    const db = getDb();

    const rowArr = await db
      .select({
        id: students.id,
        admissionNo: students.admissionNo,
        rollNo: students.rollNo,
        firstName: students.firstName,
        lastName: students.lastName,
        gender: students.gender,
        dob: students.dob,
        phone: students.phone,
        email: students.email,
        address: students.address,
        photoUrl: students.photoUrl,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        classId: students.classId,
        sectionId: students.sectionId,
        className: classes.name,
        sectionName: sections.name,
        yearName: academicYears.name,
      })
      .from(students)
      .leftJoin(classes, eq(classes.id, students.classId))
      .leftJoin(sections, eq(sections.id, students.sectionId))
      .leftJoin(academicYears, eq(academicYears.id, students.academicYearId))
      .where(eq(students.userId, context.userId))
      .limit(1);

    const student = rowArr[0];
    if (!student) return null;

    // attendance summary
    const attRows = await db
      .select({
        status: studentAttendance.status,
        c: sql<number>`count(*)::int`,
      })
      .from(studentAttendance)
      .where(eq(studentAttendance.studentId, student.id))
      .groupBy(studentAttendance.status);
    const attendance = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    for (const r of attRows) {
      const s = r.status as keyof typeof attendance;
      if (s in attendance) attendance[s] = r.c;
      attendance.total += r.c;
    }

    // fee summary
    const fee = await db
      .select({
        total: sql<number>`coalesce(sum(${feeInvoices.totalAmount}),0)::int`,
        paid: sql<number>`coalesce(sum(${feeInvoices.paidAmount}),0)::int`,
        invoices: sql<number>`count(*)::int`,
      })
      .from(feeInvoices)
      .where(eq(feeInvoices.studentId, student.id));

    return { student, attendance, fee: fee[0] };
  });

export const getMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ month: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/db/client.server");
    const { students, studentAttendance } = await import("@/db/schema");
    const db = getDb();
    const s = (
      await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.userId, context.userId))
        .limit(1)
    )[0];
    if (!s) return [];

    const conds = [eq(studentAttendance.studentId, s.id)];
    if (data.month) {
      // month like "2026-07"
      conds.push(sql`${studentAttendance.date} like ${data.month + "%"}`);
    }
    return db
      .select({
        date: studentAttendance.date,
        status: studentAttendance.status,
        note: studentAttendance.note,
      })
      .from(studentAttendance)
      .where(and(...conds))
      .orderBy(desc(studentAttendance.date));
  });

export const getMyResults = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/db/client.server");
    const { students, marks, examSubjects, exams, subjects } = await import(
      "@/db/schema"
    );
    const db = getDb();
    const s = (
      await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.userId, context.userId))
        .limit(1)
    )[0];
    if (!s) return [];

    return db
      .select({
        examId: exams.id,
        examName: exams.name,
        term: exams.term,
        isPublished: exams.isPublished,
        subjectId: subjects.id,
        subjectName: subjects.name,
        maxMarks: examSubjects.maxMarks,
        passMarks: examSubjects.passMarks,
        marksObtained: marks.marksObtained,
        isAbsent: marks.isAbsent,
      })
      .from(marks)
      .innerJoin(examSubjects, eq(examSubjects.id, marks.examSubjectId))
      .innerJoin(exams, eq(exams.id, examSubjects.examId))
      .innerJoin(subjects, eq(subjects.id, examSubjects.subjectId))
      .where(and(eq(marks.studentId, s.id), eq(exams.isPublished, true)))
      .orderBy(desc(exams.createdAt), asc(subjects.name));
  });

export const getMyFees = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/db/client.server");
    const { students, feeInvoices } = await import("@/db/schema");
    const db = getDb();
    const s = (
      await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.userId, context.userId))
        .limit(1)
    )[0];
    if (!s) return [];
    return db
      .select({
        id: feeInvoices.id,
        invoiceNo: feeInvoices.invoiceNo,
        issueDate: feeInvoices.issueDate,
        dueDate: feeInvoices.dueDate,
        totalAmount: feeInvoices.totalAmount,
        paidAmount: feeInvoices.paidAmount,
        status: feeInvoices.status,
      })
      .from(feeInvoices)
      .where(eq(feeInvoices.studentId, s.id))
      .orderBy(desc(feeInvoices.issueDate));
  });

// -------------------- Public Teacher Profile --------------------
export const getPublicTeacher = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ tenantSlug: z.string(), teacherId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants, teachers, subjects, classSubjectTeachers, classes } =
      await import("@/db/schema");
    const db = getDb();
    const t = (
      await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.slug, data.tenantSlug))
        .limit(1)
    )[0];
    if (!t) throw new Response("Not found", { status: 404 });

    const teacher = (
      await db
        .select({
          id: teachers.id,
          employeeCode: teachers.employeeCode,
          firstName: teachers.firstName,
          lastName: teachers.lastName,
          qualification: teachers.qualification,
          designation: teachers.designation,
          email: teachers.email,
          phone: teachers.phone,
          joinedOn: teachers.joinedOn,
        })
        .from(teachers)
        .where(
          and(eq(teachers.id, data.teacherId), eq(teachers.tenantId, t.id)),
        )
        .limit(1)
    )[0];
    if (!teacher) throw new Response("Not found", { status: 404 });

    const assignments = await db
      .select({
        subjectName: subjects.name,
        className: classes.name,
      })
      .from(classSubjectTeachers)
      .innerJoin(subjects, eq(subjects.id, classSubjectTeachers.subjectId))
      .innerJoin(classes, eq(classes.id, classSubjectTeachers.classId))
      .where(eq(classSubjectTeachers.teacherId, data.teacherId));

    return { tenant: t, teacher, assignments };
  });
