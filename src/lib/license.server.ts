/**
 * License validation — cryptographically signed keys.
 *
 * A license key is an ed25519-signed token (see `license-crypto.server.ts`)
 * issued by NextGen Fusion. The signed payload carries the licensed tier and,
 * optionally, the institution slug it is bound to. Because the key is signed
 * with a private key the vendor never shares, a customer cannot forge one or
 * self-upgrade to a higher tier by editing the source.
 *
 * Per product decision, license keys DO NOT expire — any `expiresAt` in the
 * payload is ignored. (The separate 14-day onboarding trial is handled in
 * `entitlements.server.ts`, not here.)
 */
import { toPlanTier, PLAN_LABELS, type PlanTier } from "./plans";
import { verifyLicenseToken } from "./license-crypto.server";
import { resolveLicensePublicKey } from "./platform-keys.server";

export interface LicensePayload {
  institution: string | null;
  /** Institution slug the key is bound to, or null if unbound. */
  slug: string | null;
  tier: PlanTier;
  planLabel: string;
  issuedAt: string | null;
  maxStudents: number;
  features: string[];
}

export interface LicenseStatus {
  valid: boolean;
  payload: LicensePayload | null;
  reason?: string;
  expiresInDays?: number | null;
}

function invalid(reason: string): LicenseStatus {
  return { valid: false, payload: null, reason };
}

export async function verifyLicense(licenseKey: string): Promise<LicenseStatus> {
  if (!licenseKey || !licenseKey.trim()) return invalid("No license");

  const publicKey = await resolveLicensePublicKey();
  if (!publicKey) {
    return invalid(
      "License verification key not configured (set LICENSE_PUBLIC_KEY)",
    );
  }

  const payload = verifyLicenseToken(licenseKey, publicKey);
  if (!payload) return invalid("Invalid or tampered license key");

  const rawTier = (payload.tier ?? payload.plan) as string | undefined;
  if (!rawTier) return invalid("License key is missing a plan tier");
  const tier = toPlanTier(rawTier);

  return {
    valid: true,
    payload: {
      institution: (payload.institution as string) ?? null,
      slug: (payload.slug as string) ?? null,
      tier,
      planLabel: PLAN_LABELS[tier],
      issuedAt: (payload.issuedAt as string) ?? null,
      maxStudents: Number(payload.maxStudents ?? 0),
      features: Array.isArray(payload.features)
        ? (payload.features as string[])
        : ["*"],
    },
    expiresInDays: null,
  };
}
