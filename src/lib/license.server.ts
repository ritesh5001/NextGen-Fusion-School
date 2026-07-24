/**
 * License validation for single-institution deployments.
 *
 * Licenses are a fixed list of 30 seeded keys, each bound to a tier — Starter,
 * Pro or Max (see `license-keys.ts`). Verification is membership in the list;
 * the matched key's tier decides how much of the product the school unlocks
 * (see `plans.ts`). A single key may be shared across multiple deployments.
 */
import { findLicense, isValidLicenseKey } from "./license-keys";
import type { PlanTier } from "./plans";
import { PLAN_LABELS } from "./plans";

export interface LicensePayload {
  institution: string | null;
  tier: PlanTier;
  planLabel: string;
  issuedAt: string | null;
  expiresAt: string | null;
  maxStudents: number;
  features: string[];
}

export interface LicenseStatus {
  valid: boolean;
  payload: LicensePayload | null;
  reason?: string;
  expiresInDays?: number | null;
}

export async function verifyLicense(licenseKey: string): Promise<LicenseStatus> {
  if (!licenseKey) return { valid: false, payload: null, reason: "No license" };
  if (!isValidLicenseKey(licenseKey)) {
    return { valid: false, payload: null, reason: "Unrecognized license key" };
  }
  const rec = findLicense(licenseKey)!;
  return {
    valid: true,
    payload: {
      institution: rec.label,
      tier: rec.tier,
      planLabel: PLAN_LABELS[rec.tier],
      issuedAt: null,
      expiresAt: null,
      maxStudents: 0,
      features: ["*"],
    },
    expiresInDays: null,
  };
}
