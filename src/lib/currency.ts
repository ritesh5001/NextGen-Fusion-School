/**
 * Currency formatting. Monetary amounts across the app are stored as **whole
 * rupee integers** (no paise) in `integer` columns. Format them for display
 * with Indian digit grouping (lakh / crore).
 */
export function formatCurrency(amount: number, symbol = "₹"): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;
}

/** Compact form for dashboards: ₹42.1L, ₹1.2Cr. */
export function formatCurrencyCompact(amount: number, symbol = "₹"): string {
  const n = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(n) >= 1_00_00_000) return `${symbol}${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 1_00_000) return `${symbol}${(n / 1_00_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1_000) return `${symbol}${(n / 1_000).toFixed(1)}K`;
  return `${symbol}${n}`;
}
