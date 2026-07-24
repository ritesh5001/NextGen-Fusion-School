/**
 * Plan tiers and feature entitlements.
 *
 * NextGen Fusion ships three license tiers. A school's tier is decided by the
 * license key it activates during setup (see `license-keys.ts` +
 * `setup.functions.ts`). The tenant's `plan` column stores the tier and is
 * carried into the client session, so both the sidebar and the route guard can
 * decide what a school is allowed to open.
 *
 * Tiers are strictly ordered: starter < pro < max. A higher tier unlocks
 * everything the tiers below it unlock, plus its own modules.
 */

export type PlanTier = "starter" | "pro" | "max";

/** Ordered list, cheapest → richest. */
export const PLAN_TIERS: PlanTier[] = ["starter", "pro", "max"];

/** Numeric rank used for "does plan X include module needing tier Y" checks. */
export const PLAN_RANK: Record<PlanTier, number> = {
  starter: 0,
  pro: 1,
  max: 2,
};

/** Human labels for badges and upgrade prompts. */
export const PLAN_LABELS: Record<PlanTier, string> = {
  starter: "Starter",
  pro: "Pro",
  max: "Max",
};

/**
 * Minimum tier required to open a given app route.
 *
 * Anything NOT listed here is a "core" module available on every tier
 * (dashboard, students, teachers, classes, subjects, academic years,
 * attendance, fees, calendar, notices, website, users, roles, settings,
 * appearance, profile). Only the modules that Pro/Max add are listed.
 */
export const MODULE_MIN_PLAN: Record<string, PlanTier> = {
  // ── Pro unlocks: full academics + finance ledger + operations ──
  "/app/exams": "pro",
  "/app/marks": "pro",
  "/app/grades": "pro",
  "/app/promotion": "pro",
  "/app/library": "pro",
  "/app/accounts": "pro",
  "/app/id-cards": "pro",
  "/app/admissions": "pro",
  "/app/reports": "pro",
  "/app/notifications": "pro",
  // ── Max unlocks: staff / operations suite ──
  "/app/hrm": "max",
  "/app/payroll": "max",
  "/app/hostel": "max",
  "/app/devops": "max",
};

/**
 * The tier a route needs; defaults to "starter" (core module). Matches exact
 * paths as well as sub-routes (e.g. "/app/exams/abc" inherits "/app/exams").
 */
export function minPlanFor(path: string): PlanTier {
  if (MODULE_MIN_PLAN[path]) return MODULE_MIN_PLAN[path];
  for (const [prefix, tier] of Object.entries(MODULE_MIN_PLAN)) {
    if (path.startsWith(prefix + "/")) return tier;
  }
  return "starter";
}

/** Is `plan` at least `required`? */
export function planAtLeast(plan: PlanTier, required: PlanTier): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

/** Can a school on `plan` open `path`? */
export function planAllowsPath(plan: PlanTier, path: string): boolean {
  return planAtLeast(plan, minPlanFor(path));
}

/** Next tier up, or null if already on the top tier. */
export function nextPlan(plan: PlanTier): PlanTier | null {
  const i = PLAN_TIERS.indexOf(plan);
  return i >= 0 && i < PLAN_TIERS.length - 1 ? PLAN_TIERS[i + 1] : null;
}

/** Normalize any stored/legacy plan string into a known tier. */
export function toPlanTier(value: string | null | undefined): PlanTier {
  if (value === "pro" || value === "max") return value;
  // Legacy enum values that predate the Starter/Pro/Max rename.
  if (value === "growth") return "pro";
  if (value === "premium") return "max";
  return "starter";
}

/** Marketing-style summary used by the license panel and upgrade prompts. */
export const PLAN_FEATURES: Record<
  PlanTier,
  { label: string; tagline: string; highlights: string[] }
> = {
  starter: {
    label: "Starter",
    tagline: "Everything a school needs to go digital.",
    highlights: [
      "Students, teachers, classes & subjects",
      "Academic years & daily attendance",
      "Fee collection & receipts",
      "Notice board & calendar",
      "Public website & appearance",
      "Users, roles & permissions",
    ],
  },
  pro: {
    label: "Pro",
    tagline: "Starter + full academics, finance & operations.",
    highlights: [
      "Everything in Starter",
      "Exams, marks entry & grade scales",
      "Student promotion",
      "Library & accounts ledger",
      "ID cards & online admissions",
      "Reports & notifications",
    ],
  },
  max: {
    label: "Max",
    tagline: "The complete institute suite — nothing held back.",
    highlights: [
      "Everything in Pro",
      "HRM & staff management",
      "Payroll & payslips",
      "Hostel management",
      "Developer utilities",
    ],
  },
};
