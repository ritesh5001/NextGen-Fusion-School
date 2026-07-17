/**
 * Runs the Drizzle migration folder against DATABASE_URL then seeds
 * baseline data: permission catalogue, system role templates, and
 * a super admin from SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD.
 *
 * Usage:
 *   bun run db:setup
 *
 * Idempotent: safe to run repeatedly.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  permissions,
  roles,
  rolePermissions,
  users,
} from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Copy .env.example to .env first.");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log("→ Running migrations…");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("✓ Migrations applied.");

  /* ---------- Permission catalogue ---------- */
  const CATALOGUE: Array<{ key: string; module: string; label: string }> = [];
  const MODULES = [
    "users", "roles", "tenants", "academic", "students", "teachers",
    "attendance", "exams", "marks", "promotion", "hr", "payroll",
    "fees", "accounts", "hostel", "library", "idcards", "calendar",
    "notices", "admissions", "reports", "notifications", "cms",
    "settings", "audit",
  ];
  const ACTIONS = ["read", "create", "update", "delete"];
  for (const m of MODULES) {
    for (const a of ACTIONS) {
      CATALOGUE.push({
        key: `${m}.${a}`,
        module: m,
        label: `${a[0].toUpperCase()}${a.slice(1)} ${m}`,
      });
    }
  }

  console.log("→ Seeding permissions…");
  for (const p of CATALOGUE) {
    await db
      .insert(permissions)
      .values(p)
      .onConflictDoNothing({ target: permissions.key });
  }

  /* ---------- System role templates (tenantId NULL) ---------- */
  const ROLE_TEMPLATES: Array<{
    key: string;
    name: string;
    description: string;
    perms: string[]; // 'module.*' or 'module.action'
  }> = [
    { key: "admin", name: "School Administrator", description: "Full access within the school", perms: ["*"] },
    { key: "principal", name: "Principal", description: "Oversight of academics and staff",
      perms: ["students.*", "teachers.*", "attendance.*", "exams.*", "marks.*", "reports.*", "notices.*", "calendar.*", "admissions.*"] },
    { key: "teacher", name: "Teacher", description: "Manage assigned classes",
      perms: ["students.read", "attendance.create", "attendance.read", "attendance.update", "marks.create", "marks.read", "marks.update", "exams.read", "notices.read", "calendar.read"] },
    { key: "accountant", name: "Accountant", description: "Manages fees, payroll, ledger",
      perms: ["fees.*", "accounts.*", "payroll.*", "reports.read"] },
    { key: "hr", name: "HR Manager", description: "Employee lifecycle",
      perms: ["hr.*", "payroll.read"] },
    { key: "librarian", name: "Librarian", description: "Library operations",
      perms: ["library.*", "students.read", "teachers.read"] },
    { key: "hostel_warden", name: "Hostel Warden", description: "Hostel management",
      perms: ["hostel.*", "students.read"] },
    { key: "student", name: "Student", description: "Self-portal access",
      perms: ["attendance.read", "marks.read", "notices.read", "calendar.read"] },
    { key: "parent", name: "Parent", description: "View ward's records",
      perms: ["attendance.read", "marks.read", "notices.read", "fees.read"] },
  ];

  console.log("→ Seeding system role templates…");
  const allPerms = await db.select().from(permissions);
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  for (const tpl of ROLE_TEMPLATES) {
    const [role] = await db
      .insert(roles)
      .values({
        tenantId: null,
        key: tpl.key,
        name: tpl.name,
        description: tpl.description,
        isSystem: true,
      })
      .onConflictDoNothing({ target: [roles.tenantId, roles.key] })
      .returning();
    const roleRow =
      role ??
      (await db
        .select()
        .from(roles)
        .where(eq(roles.key, tpl.key))
        .limit(1))[0];
    if (!roleRow) continue;

    // Expand wildcards
    const grants = new Set<string>();
    for (const p of tpl.perms) {
      if (p === "*") {
        for (const k of permByKey.keys()) grants.add(k);
      } else if (p.endsWith(".*")) {
        const mod = p.slice(0, -2);
        for (const k of permByKey.keys()) if (k.startsWith(mod + ".")) grants.add(k);
      } else {
        grants.add(p);
      }
    }
    for (const k of grants) {
      const pid = permByKey.get(k);
      if (!pid) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: roleRow.id, permissionId: pid })
        .onConflictDoNothing();
    }
  }

  /* ---------- Super admin bootstrap ---------- */
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (email && password) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!existing[0]) {
      await db.insert(users).values({
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        firstName: "Super",
        lastName: "Admin",
        isSuperAdmin: true,
        tenantId: null,
      });
      console.log(`✓ Super admin created: ${email}`);
    } else {
      console.log(`• Super admin already exists: ${email}`);
    }
  }

  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
