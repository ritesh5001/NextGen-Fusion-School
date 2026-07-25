/**
 * Client-side plan hook. Reads the tenant's entitlement tier from the session
 * and reacts to session changes (e.g. after activating a higher-tier license
 * key). Use it to drive in-context upsell UI — locked buttons, upgrade nudges,
 * and feature gates — without hardcoding tier logic in each page.
 */
import { useSyncExternalStore } from "react";
import { getSession, subscribeSession } from "./session";
import { toPlanTier, planAtLeast, PLAN_LABELS, type PlanTier } from "./plans";

export interface PlanInfo {
  plan: PlanTier;
  planLabel: string;
  isSuperAdmin: boolean;
  /** True if the current plan (or super admin) satisfies `min`. */
  allows: (min: PlanTier) => boolean;
}

export function usePlan(): PlanInfo {
  const plan = useSyncExternalStore(
    (cb) => subscribeSession(cb),
    () => toPlanTier(getSession()?.user?.tenant?.plan),
    () => "starter" as PlanTier,
  );
  const isSuperAdmin = getSession()?.user?.isSuperAdmin ?? false;
  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    isSuperAdmin,
    allows: (min: PlanTier) => isSuperAdmin || planAtLeast(plan, min),
  };
}
