/**
 * Seeded license keys for NextGen Fusion School.
 *
 * 30 pre-issued keys, split across three tiers (10 each):
 *   - Starter (NGFS-STR-…) → core school management
 *   - Pro     (NGFS-PRO-…) → Starter + academics, finance & operations
 *   - Max     (NGFS-MAX-…) → the full institute suite
 *
 * A single key MAY be handed to more than one school and reused across
 * deployments — verification is simply membership in this list, and the tier
 * on the matched key decides how much of the product that school unlocks
 * (see `plans.ts`). Editing a key's `label`/`notes` keeps track of who each
 * key was issued to. Order and index are stable so the admin panel can
 * reference them by number.
 */
import type { PlanTier } from "./plans";

export interface SeededLicense {
  index: number;
  key: string;
  tier: PlanTier;
  label: string;
  notes?: string;
}

export const LICENSE_KEYS: SeededLicense[] = [
  // ── Starter (10) ──────────────────────────────────────────────
  { index: 1,  key: "NGFS-STR-SZK7-2M94-VMP2", tier: "starter", label: "Starter License 01" },
  { index: 2,  key: "NGFS-STR-XV6R-ABG9-KE9V", tier: "starter", label: "Starter License 02" },
  { index: 3,  key: "NGFS-STR-6DTJ-CHD8-APH3", tier: "starter", label: "Starter License 03" },
  { index: 4,  key: "NGFS-STR-W9R2-5LB8-YZXX", tier: "starter", label: "Starter License 04" },
  { index: 5,  key: "NGFS-STR-6FD5-QRMZ-GG4A", tier: "starter", label: "Starter License 05" },
  { index: 6,  key: "NGFS-STR-6XRG-3Y4W-JRCD", tier: "starter", label: "Starter License 06" },
  { index: 7,  key: "NGFS-STR-LR76-VZM2-HBQN", tier: "starter", label: "Starter License 07" },
  { index: 8,  key: "NGFS-STR-UYKB-A9RJ-WQBR", tier: "starter", label: "Starter License 08" },
  { index: 9,  key: "NGFS-STR-VNHQ-C83X-ENHD", tier: "starter", label: "Starter License 09" },
  { index: 10, key: "NGFS-STR-Y9GK-Q9NF-6K54", tier: "starter", label: "Starter License 10" },

  // ── Pro (10) ──────────────────────────────────────────────────
  { index: 11, key: "NGFS-PRO-7L27-JM2L-JNFL", tier: "pro", label: "Pro License 01" },
  { index: 12, key: "NGFS-PRO-DA9A-H4KZ-6QXK", tier: "pro", label: "Pro License 02" },
  { index: 13, key: "NGFS-PRO-PHQE-7FRQ-NCA4", tier: "pro", label: "Pro License 03" },
  { index: 14, key: "NGFS-PRO-NCUT-6D8H-GLPP", tier: "pro", label: "Pro License 04" },
  { index: 15, key: "NGFS-PRO-XCRB-Y88A-TEP4", tier: "pro", label: "Pro License 05" },
  { index: 16, key: "NGFS-PRO-FDYT-J2BB-QUVU", tier: "pro", label: "Pro License 06" },
  { index: 17, key: "NGFS-PRO-LTE4-ZALL-YRQQ", tier: "pro", label: "Pro License 07" },
  { index: 18, key: "NGFS-PRO-9L4G-M4HP-D35E", tier: "pro", label: "Pro License 08" },
  { index: 19, key: "NGFS-PRO-LXTN-FBQT-9226", tier: "pro", label: "Pro License 09" },
  { index: 20, key: "NGFS-PRO-HTSM-2FBD-GWXZ", tier: "pro", label: "Pro License 10" },

  // ── Max (10) ──────────────────────────────────────────────────
  { index: 21, key: "NGFS-MAX-JQQE-B96L-DSZ6", tier: "max", label: "Max License 01" },
  { index: 22, key: "NGFS-MAX-CWRA-WU85-MG2R", tier: "max", label: "Max License 02" },
  { index: 23, key: "NGFS-MAX-TBRR-256L-K4Y7", tier: "max", label: "Max License 03" },
  { index: 24, key: "NGFS-MAX-2RWL-5KJM-3PNL", tier: "max", label: "Max License 04" },
  { index: 25, key: "NGFS-MAX-4URP-ZA3V-24CN", tier: "max", label: "Max License 05" },
  { index: 26, key: "NGFS-MAX-TXP7-4JEE-B7CF", tier: "max", label: "Max License 06" },
  { index: 27, key: "NGFS-MAX-QNJW-RK3N-P6YS", tier: "max", label: "Max License 07" },
  { index: 28, key: "NGFS-MAX-JPVY-8KH5-B9LG", tier: "max", label: "Max License 08" },
  { index: 29, key: "NGFS-MAX-K7ML-X6PZ-ZX8C", tier: "max", label: "Max License 09" },
  { index: 30, key: "NGFS-MAX-AFVE-88LS-X8HW", tier: "max", label: "Max License 10" },
];

function normalize(key: string): string {
  return key.trim().toUpperCase();
}

export function isValidLicenseKey(key: string): boolean {
  const normalized = normalize(key);
  return LICENSE_KEYS.some((l) => l.key === normalized);
}

export function findLicense(key: string): SeededLicense | null {
  const normalized = normalize(key);
  return LICENSE_KEYS.find((l) => l.key === normalized) ?? null;
}
