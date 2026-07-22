/**
 * Hardcoded license keys for NextGen Fusion School.
 *
 * These 20 keys are issued to customer schools. A single key MAY be used on
 * more than one deployment (one license, multiple schools sharing it) — the
 * verifier simply checks membership in this list.
 *
 * Edit `label` / `notes` to keep track of who each key was handed to. Order
 * and index are stable so the admin panel can reference them by number.
 */

export interface HardcodedLicense {
  index: number;
  key: string;
  label: string;
  notes?: string;
}

export const LICENSE_KEYS: HardcodedLicense[] = [
  { index: 1,  key: "NGFS-2026-AXKM-7QT2-9P4L", label: "License 01" },
  { index: 2,  key: "NGFS-2026-BZWN-3RH8-2M6K", label: "License 02" },
  { index: 3,  key: "NGFS-2026-CQVJ-8FT4-1L9D", label: "License 03" },
  { index: 4,  key: "NGFS-2026-DYPR-5NB6-7K3H", label: "License 04" },
  { index: 5,  key: "NGFS-2026-ELMS-2GC9-4J8F", label: "License 05" },
  { index: 6,  key: "NGFS-2026-FHTQ-6WD3-8N2P", label: "License 06" },
  { index: 7,  key: "NGFS-2026-GKXB-9VE1-5R7T", label: "License 07" },
  { index: 8,  key: "NGFS-2026-HRJZ-4YF7-3S1V", label: "License 08" },
  { index: 9,  key: "NGFS-2026-JNCP-1LG5-6T4W", label: "License 09" },
  { index: 10, key: "NGFS-2026-KMDL-7XH2-9U8Y", label: "License 10" },
  { index: 11, key: "NGFS-2026-LTFV-3QJ8-2A5B", label: "License 11" },
  { index: 12, key: "NGFS-2026-MWGN-8ZK4-7C6D", label: "License 12" },
  { index: 13, key: "NGFS-2026-NBHR-5PL1-3E9F", label: "License 13" },
  { index: 14, key: "NGFS-2026-PDJK-2MC6-8G4H", label: "License 14" },
  { index: 15, key: "NGFS-2026-QFKT-9NB3-1J7L", label: "License 15" },
  { index: 16, key: "NGFS-2026-RGLW-6VP8-4M2N", label: "License 16" },
  { index: 17, key: "NGFS-2026-STMY-3XQ5-7P9R", label: "License 17" },
  { index: 18, key: "NGFS-2026-TVNZ-8HR2-5S1T", label: "License 18" },
  { index: 19, key: "NGFS-2026-UWPA-1JT7-6V4X", label: "License 19" },
  { index: 20, key: "NGFS-2026-VXQB-4KU9-8Y3Z", label: "License 20" },
];

export function isValidLicenseKey(key: string): boolean {
  const normalized = key.trim().toUpperCase();
  return LICENSE_KEYS.some((l) => l.key === normalized);
}

export function findLicense(key: string): HardcodedLicense | null {
  const normalized = key.trim().toUpperCase();
  return LICENSE_KEYS.find((l) => l.key === normalized) ?? null;
}
