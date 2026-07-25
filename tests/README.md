# Testing

Three layers. Run everything with `bun run test` (or `npm test`).

## 1. Unit tests (fast, no DB) — `tests/*.test.ts`
Pure logic, the highest-risk code:
- `license-crypto.test.ts` — signing / verification / tamper & forgery rejection.
- `plans.test.ts` — tier ordering, route→plan mapping, legacy normalization.
- `entitlements.test.ts` — trial → Max, expiry → licensed tier, student caps.
- `currency.test.ts` — money formatting (whole-rupee integers, Indian grouping).
- `permissions.test.ts` — RBAC wildcard matching + role-workflow modelling.

These run anywhere; no database required.

## 2. Integration tests (real Postgres) — `tests/integration/*.int.test.ts`
Exercise server-only helpers (entitlements, trial self-heal, audit) against a
real database. **Skipped unless `TEST_DATABASE_URL` is set.**

```bash
# spin up a throwaway Postgres
docker run -d --name test-pg -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16
export TEST_DATABASE_URL=postgres://postgres:test@localhost:5433/postgres
DATABASE_URL=$TEST_DATABASE_URL bun run db:setup   # migrate + seed
bun run test
```

## 3. End-to-end API tests (recommended next)
Server functions (`createServerFn`) are HTTP endpoints. To test them
end-to-end, build and start the app, obtain an access token via `login`, then
`fetch` each endpoint asserting status codes — especially the security
behaviours added recently:
- `401` when unauthenticated, `403` when a role lacks the permission,
- `403`/`plan` gating on premium modules,
- `429` on login / admission / license-activation rate limits,
- tenant-scoping (a token for tenant A cannot read tenant B's rows).

A running Postgres + built app is required; wire this into CI (see
`.github/workflows/ci.yml`).

## What to test when you add an endpoint
- Happy path + validation failure (bad input → 400).
- AuthZ: correct `requireAccess({ perm })` — a role without it gets 403.
- Tenant isolation: the `where` clause filters by `tenantId`.
- Any money mutation runs in a `db.transaction`.
