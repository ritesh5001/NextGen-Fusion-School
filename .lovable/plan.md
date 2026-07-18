## Goal
Convert NextGen Fusion School from a multi-tenant SaaS into a **single-tenant, self-hosted ERP** that you deploy once per school on their own server + database. One codebase, one school per deployment.

## What changes

### 1. Remove multi-tenancy from the data layer
- Drop `tenant_id` foreign keys from all tables in `src/db/schema.ts` (students, teachers, classes, exams, fees, employees, hostels, library, notices, CMS, etc.).
- Keep the `tenants` table renamed to `institution` as a **single-row settings table** (school name, logo, address, academic year pointer, theme JSON). Enforce single row via a `CHECK (id = 1)` constraint.
- Remove all `.where(eq(x.tenantId, ...))` filters from every `*.functions.ts` file.
- Drop the tenant-selection step from login — login becomes plain email + password + role portal.

### 2. Remove SaaS / billing surface
- Delete `/app/tenants` (super-admin tenant directory) and its server functions.
- Delete pricing tiers, plan gating, subscription UI, Razorpay stubs, and the marketing "buy subscription" copy from `src/routes/index.tsx`.
- Rework `src/routes/index.tsx` into the **public school website** (home / about / contact) driven by the CMS tables — this becomes the school's own site once deployed.
- Move the vendor marketing site (what you show prospective schools) out of the product entirely. It is not the customer's problem.

### 3. Rework roles for a single school
Keep: `owner` (school principal / super admin for that school), `admin`, `manager`, `teacher`, `student`, `staff`, `parent` (optional), `librarian`, `accountant`, `hostel_warden`. Drop the platform-level `platform_super_admin`.

The first user created during install becomes `owner` automatically (see setup wizard below).

### 4. First-run setup wizard
On a fresh deployment, if `institution` table is empty, redirect every route to `/setup`:
- Step 1: create owner account (email + password).
- Step 2: institution details (name, address, logo upload, academic year start/end).
- Step 3: pick theme preset.
- Step 4: seed default roles, permissions, grade scale, one class, and marks the app ready.

After completion, `/setup` becomes inaccessible.

### 5. License key gate (optional but recommended)
- Add `license_key` column on `institution`. On boot, validate signature against your public key baked into the source.
- License encodes: institution name, max students, expiry (for AMC), issued date.
- You generate keys locally with a private key + a small CLI script (`scripts/issue-license.mjs`).
- App shows a warning banner if within 30 days of AMC expiry; read-only mode after expiry (still allows data export).
- This is what turns the codebase into a real "product you sell once."

### 6. Deployment package
- Write a `docker-compose.yml` bundling the app + Postgres + a volume for uploads.
- Write `INSTALL.md`: 5-step guide (edit `.env`, `docker compose up -d`, open browser, complete setup wizard, apply license key).
- Write `scripts/backup.sh` and `scripts/restore.sh` for the school's IT team.
- Keep the existing Neon-friendly path working too (for schools that want managed Postgres instead of self-hosted).

### 7. Keep intact
- All 26 feature modules (students, exams, fees, HRM, payroll, hostel, library, ID cards, admissions, CMS, reports, notifications, dev utilities).
- The theme customizer from Phase 12 — it now themes the single institution.
- All portals: manager / teacher / student / staff login.
- The `/api/public/health` endpoint.

## Execution order

1. Schema migration: drop `tenant_id` across all tables + collapse `tenants` → `institution`.
2. Strip `tenantId` from every server function and every UI page.
3. Rework login: remove tenant/slug lookup, keep role-portal selector.
4. Build `/setup` first-run wizard.
5. Rework `src/routes/index.tsx` into the school's public site (CMS-driven).
6. Delete `/app/tenants`, pricing, plan gating.
7. Add license key generator + validator (`scripts/issue-license.mjs`, boot-time check).
8. Write `docker-compose.yml` + `INSTALL.md` + backup scripts.
9. Run migrations on the current Neon DB (destructive — will wipe existing multi-tenant data; that's fine, we only have seed accounts).
10. Playwright verify: setup wizard → owner login → create teacher → create student → attendance flow.

## Technical notes

- Migrations are destructive because dropping `tenant_id` unique constraints and re-seeding is cleaner than a data migration for a project still in build phase.
- License validation uses `crypto.verify` with an ed25519 public key embedded in `src/lib/license.ts`. Private key stays on your machine only.
- The setup wizard route is `/setup` and is gated by a server-side `isInstalled()` check — once `institution` row exists, `/setup` returns 404.
- Env vars simplify: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `LICENSE_PUBLIC_KEY` (baked at build), `APP_URL`.

Approve and I'll execute all 10 steps in order.
