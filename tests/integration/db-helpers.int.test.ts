/**
 * Integration tests — exercise server-only helpers against a REAL Postgres.
 *
 * Skipped unless TEST_DATABASE_URL is set (so `bun run test` stays fast and
 * DB-free for unit tests). In CI, spin up Postgres, run migrations, then:
 *
 *   TEST_DATABASE_URL=postgres://... bun run test
 */
import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("integration: entitlements + trial (real DB)", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = TEST_DB;
  });

  it("resolves a trialing tenant to effective Max, licensed Starter", async () => {
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const { buildTenantSession } = await import("@/lib/entitlements.server");
    const db = getDb();

    const slug = `it-${Date.now()}`;
    const [t] = await db
      .insert(tenants)
      .values({
        slug,
        name: "Integration School",
        plan: "starter",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
      })
      .returning({ id: tenants.id });

    try {
      const session = await buildTenantSession(t.id);
      expect(session?.plan).toBe("max"); // trial grants Max
      expect(session?.licensedPlan).toBe("starter");
      expect(session?.trialActive).toBe(true);
    } finally {
      await db.delete(tenants).where(eq(tenants.id, t.id));
    }
  });

  it("self-heals an expired trial to 'active'", async () => {
    const { getDb } = await import("@/db/client.server");
    const { tenants } = await import("@/db/schema");
    const { loadEntitlement } = await import("@/lib/entitlements.server");
    const db = getDb();

    const slug = `it-exp-${Date.now()}`;
    const [t] = await db
      .insert(tenants)
      .values({
        slug,
        name: "Expired Trial School",
        plan: "pro",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() - 86_400_000),
      })
      .returning({ id: tenants.id });

    try {
      const ent = await loadEntitlement(t.id);
      expect(ent.effectivePlan).toBe("pro");
      expect(ent.trialActive).toBe(false);
      const [row] = await db
        .select({ status: tenants.subscriptionStatus })
        .from(tenants)
        .where(eq(tenants.id, t.id));
      expect(row.status).toBe("active"); // downgraded
    } finally {
      await db.delete(tenants).where(eq(tenants.id, t.id));
    }
  });
});
