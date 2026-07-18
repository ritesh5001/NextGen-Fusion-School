# NextGen Fusion School — School Management ERP

A complete school management system developed by [NextGen Fusion](https://nextgenfusion.in).
Built on TanStack Start (React 19 + Vite), Drizzle ORM, PostgreSQL, and a custom
JWT auth layer. Portable — no Supabase, no vendor lock. Deploy anywhere Node runs.

> **License:** This is proprietary commercial software. See [LICENSE](./LICENSE)
> for full terms. For licensing, deployment, or support inquiries, visit
> [nextgenfusion.in](https://nextgenfusion.in).

## Phase 0 — UI shell ✅

- Marketing homepage at `/`
- Dashboard shell at `/app` with 26-module nav

## Phase 1 — Postgres + auth ✅

- Postgres schema (11 tables) via Drizzle ORM
- Multi-tenant scoping (`tenants`, per-tenant users/roles)
- Custom JWT auth (access + rotating refresh tokens)
- ACL system: `roles`, `permissions`, `role_permissions`,
  `user_roles`, `user_permission_overrides`
- Password reset flow with hashed one-shot tokens
- 9 seeded system role templates
- `docker-compose.yml` for local Postgres
- Env-driven config (`.env`) so you can `git clone` and self-host

## Quick start (local)

```bash
# 1. Boot Postgres
docker compose up -d

# 2. Copy env
cp .env.example .env

# 3. Install deps
bun install

# 4. Apply migrations + seed permissions, roles, and super admin
bun run db:setup

# 5. Run the app
bun run dev
```

Open http://localhost:8080 and sign in at `/auth/login` using the
`SEED_SUPERADMIN_*` credentials from `.env` (check the "Sign in as platform
super admin" toggle).

## Project layout

```
src/
├── db/
│   ├── schema.ts            Drizzle schema (single source of truth)
│   ├── client.server.ts     Postgres client (server-only)
│   └── migrations/          Generated SQL migrations
├── lib/
│   ├── auth-core.server.ts     bcrypt + JWT primitives
│   ├── auth-middleware.server.ts requireAuth / optionalAuth for server fns
│   ├── auth.functions.ts       login / refresh / logout / me / reset / change
│   ├── permissions.server.ts   effective-permission resolver
│   └── session.ts              client-side session store
├── routes/
│   ├── index.tsx           Marketing home
│   ├── auth.login.tsx      Sign in
│   ├── auth.forgot.tsx     Forgot password
│   ├── auth.reset.tsx      Reset password
│   ├── app.tsx             Authenticated app shell
│   └── app.index.tsx       Dashboard overview
├── start.ts                Attaches Bearer token to server-fn calls
└── styles.css              Design tokens (architectural precision theme)
scripts/
└── db-setup.ts             Migrate + seed catalogue + super admin
drizzle.config.ts
docker-compose.yml
.env.example
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing keys (rotate in prod) |
| `JWT_ACCESS_TTL_SECONDS` | Access token TTL (default 900 = 15 min) |
| `JWT_REFRESH_TTL_SECONDS` | Refresh token TTL (default 14 days) |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | Bootstrap super admin |
| `APP_URL` | Public URL used for password reset links |

Generate strong secrets for production:

```bash
openssl rand -base64 48
```

## Deploying elsewhere (self-host)

The project has no runtime dependency on Lovable or Cloudflare. To deploy to
your own VPS or Node host:

1. Provision Postgres (managed or self-hosted).
2. Set the env vars above in your host's dashboard.
3. Build: `bun run build`
4. Serve the output with a Node process. TanStack Start emits a Node adapter
   in `.output/` (see TanStack Start docs for hosting targets).

## Permissions model

- Each `permission` has a stable key (`students.read`, `fees.*`, `*`).
- `roles` bundle permissions; `user_roles` binds users to roles.
- `user_permission_overrides` grant or deny individual permissions per user.
- Server functions call `requireAuth` middleware which decodes the JWT and
  exposes `context.perms`. Use `hasPerm(context.perms, "fees.collect")` to
  check.
- On the client, `hasPermission("fees.collect")` reads the same list from the
  cached session for UI gating (still enforced server-side).

## Next phase

Phase 2 candidates: tenant & school onboarding wizard, ACL permission grid
UI, academic year management, students CRUD, subscription/billing integration.
