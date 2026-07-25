/**
 * Server-only entitlement resolution: turns a tenant's stored plan + trial
 * state into the plan that actually applies right now, plus usage caps.
 *
 *  - Every school starts with a 14-day full-feature (Max) trial. While the
 *    trial is active the effective plan is "max" regardless of the licensed
 *    tier. When it ends the school downgrades to the tier its license grants.
 *  - Student caps scale with the effective plan (Starter 500, Pro 2000, Max ∞).
 */
import { toPlanTier, type PlanTier } from "./plans";

export const TRIAL_DAYS = 14;

/** Max active students per tier. null = unlimited. */
export const STUDENT_CAP: Record<PlanTier, number | null> = {
  starter: 500,
  pro: 2000,
  max: null,
};

export interface TenantEntitlementRow {
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | string | null;
}

export interface Entitlement {
  /** Tier the license key grants. */
  licensedPlan: PlanTier;
  /** Tier that applies right now (Max during an active trial). */
  effectivePlan: PlanTier;
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: string | null;
  /** Active-student cap for the effective plan; null = unlimited. */
  studentCap: number | null;
}

export function computeEntitlement(t: TenantEntitlementRow): Entitlement {
  const licensedPlan = toPlanTier(t.plan);
  let effectivePlan = licensedPlan;
  let trialActive = false;
  let trialDaysLeft = 0;
  let trialEndsAt: string | null = null;

  if (t.subscriptionStatus === "trialing" && t.trialEndsAt) {
    const end = new Date(t.trialEndsAt);
    trialEndsAt = end.toISOString();
    const ms = end.getTime() - Date.now();
    if (ms > 0) {
      trialActive = true;
      trialDaysLeft = Math.max(1, Math.ceil(ms / 86_400_000));
      effectivePlan = "max"; // full-feature trial
    }
  }

  return {
    licensedPlan,
    effectivePlan,
    trialActive,
    trialDaysLeft,
    trialEndsAt,
    studentCap: STUDENT_CAP[effectivePlan],
  };
}

const STARTER_FALLBACK: Entitlement = {
  licensedPlan: "starter",
  effectivePlan: "starter",
  trialActive: false,
  trialDaysLeft: 0,
  trialEndsAt: null,
  studentCap: STUDENT_CAP.starter,
};

/** Read-only entitlement lookup (no writes) — safe to call on every request. */
export async function readEntitlement(tenantId: string): Promise<Entitlement> {
  const { getDb } = await import("@/db/client.server");
  const { tenants } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const row = (
    await db
      .select({
        plan: tenants.plan,
        subscriptionStatus: tenants.subscriptionStatus,
        trialEndsAt: tenants.trialEndsAt,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
  )[0];
  return row ? computeEntitlement(row) : STARTER_FALLBACK;
}

/**
 * Like `readEntitlement`, but downgrades an expired trial: once the 14-day
 * window passes it flips `subscription_status` from "trialing" to "active" so
 * the tenant settles on its licensed tier. Call from auth flows.
 */
export async function loadEntitlement(tenantId: string): Promise<Entitlement> {
  const { getDb } = await import("@/db/client.server");
  const { tenants } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const row = (
    await db
      .select({
        plan: tenants.plan,
        subscriptionStatus: tenants.subscriptionStatus,
        trialEndsAt: tenants.trialEndsAt,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
  )[0];
  if (!row) return STARTER_FALLBACK;
  const ent = computeEntitlement(row);
  if (row.subscriptionStatus === "trialing" && !ent.trialActive) {
    await db
      .update(tenants)
      .set({ subscriptionStatus: "active" })
      .where(eq(tenants.id, tenantId));
  }
  return ent;
}

export interface TenantSession {
  id: string;
  name: string;
  slug: string;
  /** Effective plan — "max" during an active trial. Drives UI gating. */
  plan: PlanTier;
  /** Tier the license grants (what applies once the trial ends). */
  licensedPlan: PlanTier;
  trialActive: boolean;
  trialDaysLeft: number;
}

/**
 * Build the tenant object embedded in a user's session, resolving the
 * effective plan and trial state. Self-heals an expired trial to "active".
 */
export async function buildTenantSession(
  tenantId: string,
): Promise<TenantSession | null> {
  const { getDb } = await import("@/db/client.server");
  const { tenants } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const t = (
    await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        plan: tenants.plan,
        subscriptionStatus: tenants.subscriptionStatus,
        trialEndsAt: tenants.trialEndsAt,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
  )[0];
  if (!t) return null;
  const ent = computeEntitlement(t);
  if (t.subscriptionStatus === "trialing" && !ent.trialActive) {
    await db
      .update(tenants)
      .set({ subscriptionStatus: "active" })
      .where(eq(tenants.id, tenantId));
  }
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: ent.effectivePlan,
    licensedPlan: ent.licensedPlan,
    trialActive: ent.trialActive,
    trialDaysLeft: ent.trialDaysLeft,
  };
}

/** Count active students for cap enforcement. */
export async function countActiveStudents(tenantId: string): Promise<number> {
  const { getDb } = await import("@/db/client.server");
  const { students } = await import("@/db/schema");
  const { and, eq, sql } = await import("drizzle-orm");
  const db = getDb();
  const r = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.isActive, true)));
  return r[0]?.n ?? 0;
}
