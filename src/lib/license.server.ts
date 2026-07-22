/**
 * License validation for single-institution deployments.
 *
 * Licenses are a fixed list of 20 hardcoded keys (see `license-keys.ts`).
 * A single key may be shared across multiple deployments — verification is
 * just membership in the list.
 */
import { findLicense, isValidLicenseKey } from "./license-keys";

export interface LicensePayload {
  institution: string | null;
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
      issuedAt: null,
      expiresAt: null,
      maxStudents: 0,
      features: ["*"],
    },
    expiresInDays: null,
  };
}
