/**
 * Client-side export helpers for analytics dashboards.
 * CSV is generated and downloaded in-browser; PDF uses the browser's print
 * dialog scoped to the dashboard (no extra dependency).
 */

/** Escape a value for CSV (quote if it contains comma, quote, or newline). */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV from one or more named tables and trigger a download.
 * Each section renders as a titled block separated by a blank line.
 */
export function downloadCsv(
  filename: string,
  sections: { title: string; headers: string[]; rows: (string | number | null)[][] }[],
) {
  const lines: string[] = [];
  for (const sec of sections) {
    lines.push(csvCell(sec.title));
    lines.push(sec.headers.map(csvCell).join(","));
    for (const r of sec.rows) lines.push(r.map(csvCell).join(","));
    lines.push(""); // blank line between sections
  }
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print the current dashboard to PDF via the browser's print dialog.
 * The print stylesheet (in styles.css) hides chrome and keeps only the
 * element carrying `data-print-region`.
 */
export function printToPdf() {
  window.print();
}
