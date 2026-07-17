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
export const planTier = pgEnum("plan_tier", ["starter", "growth", "premium"]);
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
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
