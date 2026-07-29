/**
 * Date/time formatting for display. Dates are stored as ISO strings
 * (YYYY-MM-DD) or timestamps; render them with the Indian locale so staff
 * never see raw `2026-04-05` output.
 */

function toDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** "5 Apr 2026" */
export function formatDate(d: string | Date | null | undefined, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "5 Apr" — no year, for compact columns */
export function formatDateShort(d: string | Date | null | undefined, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "5 Apr 2026, 3:42 PM" */
export function formatDateTime(d: string | Date | null | undefined, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  return dt.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/** "2 days ago", "in 3 days", "just now" — relative to now. */
export function formatRelative(d: string | Date | null | undefined, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  const diffMs = dt.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const day = 86_400_000;
  if (abs < 60_000) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
  if (abs < 365 * day) return rtf.format(Math.round(diffMs / (30 * day)), "month");
  return rtf.format(Math.round(diffMs / (365 * day)), "year");
}
