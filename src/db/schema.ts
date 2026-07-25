import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ============================================================
 * Enums
 * ============================================================ */
export const planTier = pgEnum("plan_tier", ["starter", "pro", "max"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
]);

/* ============================================================
 * Tenants (each school = one tenant)
 * ============================================================ */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    plan: planTier("plan").notNull().default("starter"),
    subscriptionStatus: subscriptionStatus("subscription_status")
      .notNull()
      .default("trialing"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    subscriptionEndsAt: timestamp("subscription_ends_at", {
      withTimezone: true,
    }),
    // Public homepage content (editable from admin) — JSON blob stored as text
    homepageJson: text("homepage_json"),
    // Per-tenant theme (preset + overrides). See src/lib/theme-client.ts
    themeJson: text("theme_json"),
    // Signed license key for this deployment (see src/lib/license.server.ts)
    licenseKey: text("license_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("tenants_slug_uniq").on(t.slug)],
);

/* ============================================================
 * Platform signing keypair (single row, vendor-only)
 * Used to sign license keys directly from the admin panel.
 * ============================================================ */
export const platformKeys = pgTable("platform_keys", {
  id: integer("id").primaryKey().default(1),
  privateKey: text("private_key").notNull(),
  publicKey: text("public_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ============================================================
 * Academic years (scoped per tenant, one active at a time)
 * ============================================================ */
export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startsOn: timestamp("starts_on", { withTimezone: true }).notNull(),
    endsOn: timestamp("ends_on", { withTimezone: true }).notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ay_tenant_idx").on(t.tenantId)],
);

/* ============================================================
 * Users
 *   - A user belongs to at most one tenant (tenantId nullable => super admin)
 *   - Email is unique per tenant; super admins have tenantId NULL
 * ============================================================ */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Unique per tenant. NULL tenantId (super admins) uses a partial unique.
    uniqueIndex("users_tenant_email_uniq")
      .on(t.tenantId, t.email)
      .where(sql`${t.tenantId} is not null`),
    uniqueIndex("users_superadmin_email_uniq")
      .on(t.email)
      .where(sql`${t.tenantId} is null`),
    index("users_tenant_idx").on(t.tenantId),
  ],
);

/* ============================================================
 * Roles (per tenant). System roles have tenantId NULL and are template roles.
 * ============================================================ */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(), // e.g. 'admin', 'teacher', 'student', 'parent', 'accountant'
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("roles_tenant_key_uniq").on(t.tenantId, t.key),
    index("roles_tenant_idx").on(t.tenantId),
  ],
);

/* ============================================================
 * Permissions catalogue — global registry keyed by string
 *   e.g. 'students.read', 'students.write', 'fees.collect', ...
 * ============================================================ */
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    module: text("module").notNull(), // 'students', 'fees', 'library', ...
    label: text("label").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("permissions_key_uniq").on(t.key)],
);

/* ============================================================
 * Role ↔ Permission
 * ============================================================ */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

/* ============================================================
 * User ↔ Role (many-to-many, scoped by user's tenant)
 * ============================================================ */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

/* ============================================================
 * Per-user permission overrides (grant/deny on top of roles)
 * ============================================================ */
export const userPermissionOverrides = pgTable(
  "user_permission_overrides",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    // true = grant, false = deny
    allow: boolean("allow").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permissionId] })],
);

/* ============================================================
 * Refresh tokens (rotated on each refresh; revoked on logout)
 * ============================================================ */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rt_user_idx").on(t.userId),
    uniqueIndex("rt_hash_uniq").on(t.tokenHash),
  ],
);

/* ============================================================
 * Password reset tokens
 * ============================================================ */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("pr_hash_uniq").on(t.tokenHash),
    index("pr_user_idx").on(t.userId),
  ],
);

/* ============================================================
 * Audit log (light — extend later)
 * ============================================================ */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: text("meta"), // JSON
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_tenant_idx").on(t.tenantId),
    index("audit_user_idx").on(t.userId),
  ],
);

/* ============================================================
 * Relations
 * ============================================================ */
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  roles: many(roles),
  academicYears: many(academicYears),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  userRoles: many(userRoles),
  overrides: many(userPermissionOverrides),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolePermissions.roleId],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
  }),
);

/* ============================================================
 * Academic — Classes, Sections, Subjects
 * ============================================================ */
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Class 10", "Grade 5"
    numericGrade: integer("numeric_grade"), // 1..12 for ordering; null = other
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("classes_tenant_idx").on(t.tenantId),
    index("classes_year_idx").on(t.academicYearId),
  ],
);

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "A", "B", "Red"
    capacity: integer("capacity").notNull().default(40),
    classTeacherId: uuid("class_teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sections_class_idx").on(t.classId)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("subjects_tenant_code_uniq")
      .on(t.tenantId, t.code)
      .where(sql`${t.code} is not null`),
    index("subjects_tenant_idx").on(t.tenantId),
  ],
);

/* ============================================================
 * Students
 * ============================================================ */
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    admissionNo: text("admission_no").notNull(),
    rollNo: text("roll_no"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    gender: genderEnum("gender"),
    dob: timestamp("dob", { withTimezone: true }),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    photoUrl: text("photo_url"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    guardianEmail: text("guardian_email"),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    sectionId: uuid("section_id").references(() => sections.id, {
      onDelete: "set null",
    }),
    academicYearId: uuid("academic_year_id").references(() => academicYears.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("students_tenant_admission_uniq").on(t.tenantId, t.admissionNo),
    index("students_tenant_idx").on(t.tenantId),
    index("students_class_idx").on(t.classId),
    index("students_section_idx").on(t.sectionId),
  ],
);

/* ============================================================
 * Institute settings — one row per tenant (key/value blob)
 * ============================================================ */
export const instituteSettings = pgTable("institute_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  motto: text("motto"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  currency: text("currency").notNull().default("INR"),
  currencySymbol: text("currency_symbol").notNull().default("₹"),
  // SMTP / email (Phase 10)
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUsername: text("smtp_username"),
  smtpPassword: text("smtp_password"),
  smtpFromEmail: text("smtp_from_email"),
  smtpFromName: text("smtp_from_name"),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  // Report settings (Phase 10)
  reportHeader: text("report_header"),
  reportFooter: text("report_footer"),
  reportLogoUrl: text("report_logo_url"),
  reportSignatureUrl: text("report_signature_url"),
  reportPrincipalName: text("report_principal_name"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});


/* ============================================================
 * Teachers — profile record for teaching staff (Phase 3)
 * ============================================================ */
export const teachers = pgTable(
  "teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    employeeCode: text("employee_code").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    gender: genderEnum("gender"),
    dob: timestamp("dob", { withTimezone: true }),
    phone: text("phone"),
    email: text("email"),
    qualification: text("qualification"),
    designation: text("designation"),
    joinedOn: timestamp("joined_on", { withTimezone: true }),
    address: text("address"),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("teachers_tenant_code_uniq").on(t.tenantId, t.employeeCode),
    index("teachers_tenant_idx").on(t.tenantId),
  ],
);

/* ============================================================
 * Class ↔ Subject ↔ Teacher mapping
 * ============================================================ */
export const classSubjectTeachers = pgTable(
  "class_subject_teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => sections.id, {
      onDelete: "cascade",
    }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("cst_unique").on(
      t.classId,
      t.sectionId,
      t.subjectId,
      t.teacherId,
    ),
    index("cst_tenant_idx").on(t.tenantId),
    index("cst_class_idx").on(t.classId),
  ],
);

/* ============================================================
 * Attendance
 * ============================================================ */
export const attendanceStatus = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);

export const studentAttendance = pgTable(
  "student_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    status: attendanceStatus("status").notNull(),
    note: text("note"),
    markedById: uuid("marked_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("stu_att_unique").on(t.studentId, t.date),
    index("stu_att_tenant_idx").on(t.tenantId),
    index("stu_att_section_date_idx").on(t.sectionId, t.date),
  ],
);

export const employeeAttendance = pgTable(
  "employee_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    status: attendanceStatus("status").notNull(),
    checkIn: text("check_in"),
    checkOut: text("check_out"),
    note: text("note"),
    markedById: uuid("marked_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("emp_att_unique").on(t.teacherId, t.date),
    index("emp_att_tenant_idx").on(t.tenantId),
    index("emp_att_date_idx").on(t.date),
  ],
);

/* ============================================================
 * Phase 4 — Grade scales, Exams, Exam Subjects, Marks
 * ============================================================ */
export const gradeScales = pgTable(
  "grade_scales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("grade_scales_tenant_idx").on(t.tenantId)],
);

export const grades = pgTable(
  "grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    scaleId: uuid("scale_id")
      .notNull()
      .references(() => gradeScales.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // A+, A, B, ...
    minPercent: integer("min_percent").notNull(),
    maxPercent: integer("max_percent").notNull(),
    gpa: text("gpa"),
    remark: text("remark"),
  },
  (t) => [
    index("grades_scale_idx").on(t.scaleId),
    index("grades_tenant_idx").on(t.tenantId),
  ],
);

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id").references(() => academicYears.id, {
      onDelete: "set null",
    }),
    gradeScaleId: uuid("grade_scale_id").references(() => gradeScales.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    term: text("term"),
    startsOn: text("starts_on"),
    endsOn: text("ends_on"),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("exams_tenant_idx").on(t.tenantId)],
);

export const examSubjects = pgTable(
  "exam_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    maxMarks: integer("max_marks").notNull().default(100),
    passMarks: integer("pass_marks").notNull().default(35),
    examDate: text("exam_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("exam_subjects_unique").on(t.examId, t.classId, t.subjectId),
    index("exam_subjects_tenant_idx").on(t.tenantId),
    index("exam_subjects_exam_idx").on(t.examId),
  ],
);

export const marks = pgTable(
  "marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    examSubjectId: uuid("exam_subject_id")
      .notNull()
      .references(() => examSubjects.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    marksObtained: integer("marks_obtained"),
    isAbsent: boolean("is_absent").notNull().default(false),
    remark: text("remark"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("marks_unique").on(t.examSubjectId, t.studentId),
    index("marks_tenant_idx").on(t.tenantId),
    index("marks_student_idx").on(t.studentId),
  ],
);

export type GradeScale = typeof gradeScales.$inferSelect;
export type Grade = typeof grades.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type ExamSubject = typeof examSubjects.$inferSelect;
export type Mark = typeof marks.$inferSelect;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type AcademicYear = typeof academicYears.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Teacher = typeof teachers.$inferSelect;
export type NewTeacher = typeof teachers.$inferInsert;
export type ClassSubjectTeacher = typeof classSubjectTeachers.$inferSelect;
export type StudentAttendance = typeof studentAttendance.$inferSelect;
export type EmployeeAttendance = typeof employeeAttendance.$inferSelect;


/* ============================================================
 * Phase 5 — Fees, Accounts, Promotion
 * ============================================================ */
export const feeInvoiceStatus = pgEnum("fee_invoice_status", [
  "unpaid",
  "partial",
  "paid",
  "cancelled",
]);
export const accountKind = pgEnum("account_kind", ["income", "expense"]);
export const paymentMethod = pgEnum("payment_method", [
  "cash",
  "bank",
  "upi",
  "card",
  "cheque",
  "online",
  "other",
]);

export const feeHeads = pgTable(
  "fee_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    isRecurring: boolean("is_recurring").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("fee_heads_tenant_idx").on(t.tenantId),
    uniqueIndex("fee_heads_tenant_name_uniq").on(t.tenantId, t.name),
  ],
);

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    feeHeadId: uuid("fee_head_id")
      .notNull()
      .references(() => feeHeads.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    term: text("term"),
    dueDay: integer("due_day"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("fee_struct_tenant_idx").on(t.tenantId),
    index("fee_struct_class_idx").on(t.classId),
    index("fee_struct_year_idx").on(t.academicYearId),
  ],
);

export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceNo: text("invoice_no").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id").references(() => academicYears.id, {
      onDelete: "set null",
    }),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    totalAmount: integer("total_amount").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    status: feeInvoiceStatus("status").notNull().default("unpaid"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("fee_inv_no_uniq").on(t.tenantId, t.invoiceNo),
    index("fee_inv_tenant_idx").on(t.tenantId),
    index("fee_inv_student_idx").on(t.studentId),
    index("fee_inv_status_idx").on(t.status),
  ],
);

export const feeInvoiceItems = pgTable(
  "fee_invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "cascade" }),
    feeHeadId: uuid("fee_head_id").references(() => feeHeads.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [index("fee_inv_item_invoice_idx").on(t.invoiceId)],
);

export const feePayments = pgTable(
  "fee_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    method: paymentMethod("method").notNull().default("cash"),
    reference: text("reference"),
    paidOn: text("paid_on").notNull(),
    remarks: text("remarks"),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("fee_pay_invoice_idx").on(t.invoiceId),
    index("fee_pay_tenant_idx").on(t.tenantId),
  ],
);

export const accountHeads = pgTable(
  "account_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: accountKind("kind").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("acc_heads_uniq").on(t.tenantId, t.name),
    index("acc_heads_tenant_idx").on(t.tenantId),
  ],
);

export const accountTransactions = pgTable(
  "account_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accountHeadId: uuid("account_head_id")
      .notNull()
      .references(() => accountHeads.id, { onDelete: "restrict" }),
    kind: accountKind("kind").notNull(),
    txDate: text("tx_date").notNull(),
    amount: integer("amount").notNull(),
    description: text("description"),
    reference: text("reference"),
    feePaymentId: uuid("fee_payment_id").references(() => feePayments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("acc_tx_tenant_idx").on(t.tenantId),
    index("acc_tx_head_idx").on(t.accountHeadId),
    index("acc_tx_date_idx").on(t.txDate),
  ],
);

export const promotionLogs = pgTable(
  "promotion_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    fromYearId: uuid("from_year_id").references(() => academicYears.id, {
      onDelete: "set null",
    }),
    toYearId: uuid("to_year_id").references(() => academicYears.id, {
      onDelete: "set null",
    }),
    fromClassId: uuid("from_class_id"),
    fromSectionId: uuid("from_section_id"),
    toClassId: uuid("to_class_id"),
    toSectionId: uuid("to_section_id"),
    outcome: text("outcome").notNull(),
    performedBy: uuid("performed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("promo_tenant_idx").on(t.tenantId),
    index("promo_student_idx").on(t.studentId),
  ],
);

export type FeeHead = typeof feeHeads.$inferSelect;
export type FeeStructure = typeof feeStructures.$inferSelect;
export type FeeInvoice = typeof feeInvoices.$inferSelect;
export type FeeInvoiceItem = typeof feeInvoiceItems.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
export type AccountHead = typeof accountHeads.$inferSelect;
export type AccountTransaction = typeof accountTransactions.$inferSelect;
export type PromotionLog = typeof promotionLogs.$inferSelect;

/* ============================================================
 * Phase 6 — HRM & Payroll
 * ============================================================ */
export const leaveStatus = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const componentKind = pgEnum("component_kind", ["earning", "deduction"]);
export const payslipStatus = pgEnum("payslip_status", [
  "draft",
  "finalized",
  "paid",
]);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    employeeCode: text("employee_code").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    gender: genderEnum("gender"),
    dob: timestamp("dob", { withTimezone: true }),
    phone: text("phone"),
    email: text("email"),
    designation: text("designation"),
    department: text("department"),
    joinedOn: timestamp("joined_on", { withTimezone: true }),
    address: text("address"),
    photoUrl: text("photo_url"),
    bankName: text("bank_name"),
    bankAccountNo: text("bank_account_no"),
    bankIfsc: text("bank_ifsc"),
    panNo: text("pan_no"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("employees_tenant_code_uniq").on(t.tenantId, t.employeeCode),
    index("employees_tenant_idx").on(t.tenantId),
  ],
);

export const leaveTypes = pgTable(
  "leave_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    annualQuota: integer("annual_quota").notNull().default(0),
    isPaid: boolean("is_paid").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("leave_types_tenant_idx").on(t.tenantId)],
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveTypeId: uuid("leave_type_id").references(() => leaveTypes.id, {
      onDelete: "set null",
    }),
    fromDate: text("from_date").notNull(),
    toDate: text("to_date").notNull(),
    days: integer("days").notNull().default(1),
    reason: text("reason"),
    status: leaveStatus("status").notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("leave_req_tenant_idx").on(t.tenantId),
    index("leave_req_emp_idx").on(t.employeeId),
  ],
);

export const hrPolicies = pgTable(
  "hr_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    effectiveFrom: text("effective_from"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("hr_policies_tenant_idx").on(t.tenantId)],
);

export const workOutsideLogs = pgTable(
  "work_outside_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    logDate: text("log_date").notNull(),
    location: text("location"),
    purpose: text("purpose").notNull(),
    hours: integer("hours"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("work_outside_tenant_idx").on(t.tenantId),
    index("work_outside_emp_idx").on(t.employeeId),
  ],
);

export const salaryComponents = pgTable(
  "salary_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    kind: componentKind("kind").notNull(),
    isPercentage: boolean("is_percentage").notNull().default(false),
    defaultValue: integer("default_value").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("salary_comp_tenant_idx").on(t.tenantId)],
);

export const salaryTemplates = pgTable(
  "salary_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("salary_tpl_tenant_idx").on(t.tenantId)],
);

export const salaryTemplateComponents = pgTable(
  "salary_template_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => salaryTemplates.id, { onDelete: "cascade" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => salaryComponents.id, { onDelete: "cascade" }),
    value: integer("value").notNull().default(0),
  },
  (t) => [
    uniqueIndex("salary_tpl_comp_uniq").on(t.templateId, t.componentId),
  ],
);

export const employeeSalaryAssignments = pgTable(
  "employee_salary_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => salaryTemplates.id, { onDelete: "restrict" }),
    basic: integer("basic").notNull().default(0),
    effectiveFrom: text("effective_from").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("emp_sal_tenant_idx").on(t.tenantId),
    index("emp_sal_emp_idx").on(t.employeeId),
  ],
);

export const payslips = pgTable(
  "payslips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    basic: integer("basic").notNull().default(0),
    grossEarnings: integer("gross_earnings").notNull().default(0),
    totalDeductions: integer("total_deductions").notNull().default(0),
    netPay: integer("net_pay").notNull().default(0),
    status: payslipStatus("status").notNull().default("draft"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidVia: text("paid_via"),
    reference: text("reference"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payslip_emp_period_uniq").on(
      t.tenantId,
      t.employeeId,
      t.periodYear,
      t.periodMonth,
    ),
    index("payslip_tenant_idx").on(t.tenantId),
    index("payslip_period_idx").on(t.periodYear, t.periodMonth),
  ],
);

export const payslipItems = pgTable(
  "payslip_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payslipId: uuid("payslip_id")
      .notNull()
      .references(() => payslips.id, { onDelete: "cascade" }),
    componentId: uuid("component_id").references(() => salaryComponents.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    kind: componentKind("kind").notNull(),
    amount: integer("amount").notNull().default(0),
  },
  (t) => [index("payslip_items_slip_idx").on(t.payslipId)],
);

export type Employee = typeof employees.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type HrPolicy = typeof hrPolicies.$inferSelect;
export type WorkOutsideLog = typeof workOutsideLogs.$inferSelect;
export type SalaryComponent = typeof salaryComponents.$inferSelect;
export type SalaryTemplate = typeof salaryTemplates.$inferSelect;
export type SalaryTemplateComponent =
  typeof salaryTemplateComponents.$inferSelect;
export type EmployeeSalaryAssignment =
  typeof employeeSalaryAssignments.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
export type PayslipItem = typeof payslipItems.$inferSelect;

/* ============================================================
 * Phase 7 — Hostel, Library, Notices, Calendar
 * ============================================================ */
export const hostelType = pgEnum("hostel_type", ["boys", "girls", "mixed"]);
export const allocationStatus = pgEnum("allocation_status", [
  "active",
  "vacated",
]);
export const borrowerType = pgEnum("borrower_type", ["student", "employee"]);
export const issueStatus = pgEnum("issue_status", [
  "issued",
  "returned",
  "overdue",
  "lost",
]);
export const eventType = pgEnum("event_type", [
  "holiday",
  "exam",
  "event",
  "meeting",
  "other",
]);

export const hostels = pgTable(
  "hostels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: hostelType("type").notNull().default("boys"),
    address: text("address"),
    wardenName: text("warden_name"),
    wardenPhone: text("warden_phone"),
    capacity: integer("capacity").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("hostels_tenant_idx").on(t.tenantId)],
);

export const hostelRooms = pgTable(
  "hostel_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    hostelId: uuid("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "cascade" }),
    roomNo: text("room_no").notNull(),
    floor: text("floor"),
    capacity: integer("capacity").notNull().default(1),
    monthlyRent: integer("monthly_rent").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("hostel_room_uniq").on(t.hostelId, t.roomNo),
    index("hostel_rooms_tenant_idx").on(t.tenantId),
  ],
);

export const hostelAllocations = pgTable(
  "hostel_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => hostelRooms.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    allocatedOn: text("allocated_on").notNull(),
    vacatedOn: text("vacated_on"),
    status: allocationStatus("status").notNull().default("active"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("hostel_alloc_tenant_idx").on(t.tenantId),
    index("hostel_alloc_room_idx").on(t.roomId),
    index("hostel_alloc_student_idx").on(t.studentId),
  ],
);

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    author: text("author"),
    isbn: text("isbn"),
    category: text("category"),
    publisher: text("publisher"),
    edition: text("edition"),
    totalCopies: integer("total_copies").notNull().default(1),
    availableCopies: integer("available_copies").notNull().default(1),
    rackNo: text("rack_no"),
    dailyFine: integer("daily_fine").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("books_tenant_idx").on(t.tenantId),
    index("books_title_idx").on(t.title),
  ],
);

export const bookIssues = pgTable(
  "book_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    borrowerType: borrowerType("borrower_type").notNull(),
    studentId: uuid("student_id").references(() => students.id, {
      onDelete: "set null",
    }),
    employeeId: uuid("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    issuedOn: text("issued_on").notNull(),
    dueDate: text("due_date").notNull(),
    returnedOn: text("returned_on"),
    fineAmount: integer("fine_amount").notNull().default(0),
    fineCollected: integer("fine_collected").notNull().default(0),
    status: issueStatus("status").notNull().default("issued"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("book_issues_tenant_idx").on(t.tenantId),
    index("book_issues_book_idx").on(t.bookId),
    index("book_issues_status_idx").on(t.status),
  ],
);

export const notices = pgTable(
  "notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audience: text("audience").notNull().default("all"),
    publishFrom: text("publish_from"),
    publishTo: text("publish_to"),
    isPinned: boolean("is_pinned").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notices_tenant_idx").on(t.tenantId)],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    isAllDay: boolean("is_all_day").notNull().default(true),
    type: eventType("type").notNull().default("event"),
    color: text("color"),
    location: text("location"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cal_events_tenant_idx").on(t.tenantId),
    index("cal_events_start_idx").on(t.startDate),
  ],
);

export type Hostel = typeof hostels.$inferSelect;
export type HostelRoom = typeof hostelRooms.$inferSelect;
export type HostelAllocation = typeof hostelAllocations.$inferSelect;
export type Book = typeof books.$inferSelect;
export type BookIssue = typeof bookIssues.$inferSelect;
export type Notice = typeof notices.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

/* ============================================================
 * Phase 8 — ID Cards, Admissions, Notifications
 * ============================================================ */
export const admissionStatus = pgEnum("admission_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "enrolled",
]);

export const idCardTemplates = pgTable(
  "id_card_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    audience: text("audience").notNull().default("student"), // student|teacher|employee
    orientation: text("orientation").notNull().default("portrait"),
    widthMm: integer("width_mm").notNull().default(54),
    heightMm: integer("height_mm").notNull().default(86),
    accentColor: text("accent_color").notNull().default("#10b981"),
    backgroundColor: text("background_color").notNull().default("#ffffff"),
    textColor: text("text_color").notNull().default("#0a0a0a"),
    logoUrl: text("logo_url"),
    showPhoto: boolean("show_photo").notNull().default(true),
    showQr: boolean("show_qr").notNull().default(true),
    footerText: text("footer_text"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idcard_tpl_tenant_idx").on(t.tenantId)],
);

export const admissionApplications = pgTable(
  "admission_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    applicationNo: text("application_no").notNull(),
    academicYearId: uuid("academic_year_id").references(() => academicYears.id, {
      onDelete: "set null",
    }),
    classAppliedId: uuid("class_applied_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    gender: genderEnum("gender"),
    dob: text("dob"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    guardianEmail: text("guardian_email"),
    address: text("address"),
    previousSchool: text("previous_school"),
    remarks: text("remarks"),
    // DPDP: verifiable parental consent captured at submission.
    parentalConsent: boolean("parental_consent").notNull().default(false),
    consentName: text("consent_name"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    status: admissionStatus("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    enrolledStudentId: uuid("enrolled_student_id").references(() => students.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("admission_no_uniq").on(t.tenantId, t.applicationNo),
    index("admissions_tenant_idx").on(t.tenantId),
    index("admissions_status_idx").on(t.status),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    category: text("category").notNull().default("general"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifs_user_idx").on(t.userId),
    index("notifs_tenant_idx").on(t.tenantId),
    index("notifs_read_idx").on(t.isRead),
  ],
);

export type IdCardTemplate = typeof idCardTemplates.$inferSelect;
export type AdmissionApplication = typeof admissionApplications.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

/* ============================================================
 * Phase 9 — Public Website / CMS
 * ============================================================ */
export const siteMeta = pgTable("site_meta", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  heroTitle: text("hero_title"),
  heroSubtitle: text("hero_subtitle"),
  heroImageUrl: text("hero_image_url"),
  aboutHtml: text("about_html"),
  missionHtml: text("mission_html"),
  visionHtml: text("vision_html"),
  footerText: text("footer_text"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactAddress: text("contact_address"),
  mapEmbed: text("map_embed"),
  socialFacebook: text("social_facebook"),
  socialInstagram: text("social_instagram"),
  socialTwitter: text("social_twitter"),
  socialYoutube: text("social_youtube"),
  socialLinkedin: text("social_linkedin"),
  googleAnalyticsId: text("google_analytics_id"),
  language: text("language").notNull().default("en"),
  isPublished: boolean("is_published").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const siteSliders = pgTable(
  "site_sliders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    imageUrl: text("image_url").notNull(),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("site_sliders_tenant_idx").on(t.tenantId)],
);

export const siteTestimonials = pgTable(
  "site_testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role"),
    quote: text("quote").notNull(),
    avatarUrl: text("avatar_url"),
    rating: integer("rating").notNull().default(5),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("site_testimonials_tenant_idx").on(t.tenantId)],
);

export const siteGallery = pgTable(
  "site_gallery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title"),
    imageUrl: text("image_url").notNull(),
    category: text("category").notNull().default("general"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("site_gallery_tenant_idx").on(t.tenantId)],
);

export const siteFaqs = pgTable(
  "site_faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: text("category").notNull().default("general"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("site_faqs_tenant_idx").on(t.tenantId)],
);

export const siteTimeline = pgTable(
  "site_timeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    yearLabel: text("year_label").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("site_timeline_tenant_idx").on(t.tenantId)],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    subject: text("subject"),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contact_messages_tenant_idx").on(t.tenantId),
    index("contact_messages_read_idx").on(t.isRead),
  ],
);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("newsletter_tenant_email_uniq").on(t.tenantId, t.email),
    index("newsletter_tenant_idx").on(t.tenantId),
  ],
);

export type SiteMeta = typeof siteMeta.$inferSelect;
export type SiteSlider = typeof siteSliders.$inferSelect;
export type SiteTestimonial = typeof siteTestimonials.$inferSelect;
export type SiteGalleryItem = typeof siteGallery.$inferSelect;
export type SiteFaq = typeof siteFaqs.$inferSelect;
export type SiteTimelineItem = typeof siteTimeline.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

/* ============================================================
 * Phase 10 — System logs (audit / activity trail)
 * ============================================================ */
export const systemLogs = pgTable(
  "system_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    level: text("level").notNull().default("info"), // info | warn | error
    category: text("category").notNull().default("system"),
    message: text("message").notNull(),
    metadata: text("metadata"), // JSON string
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("system_logs_tenant_idx").on(t.tenantId),
    index("system_logs_created_idx").on(t.createdAt),
    index("system_logs_level_idx").on(t.level),
  ],
);

export type SystemLog = typeof systemLogs.$inferSelect;





