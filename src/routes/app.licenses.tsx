import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listLicenseKeys } from "@/lib/license-issue.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Copy, KeyRound } from "lucide-react";
import { PLAN_TIERS, PLAN_FEATURES, type PlanTier } from "@/lib/plans";

export const Route = createFileRoute("/app/licenses")({
  component: LicensesPage,
});

type Row = { index: number; key: string; tier: PlanTier; label: string; notes?: string };

const TIER_STYLES: Record<PlanTier, string> = {
  starter: "bg-slate-500/10 text-slate-600 ring-slate-500/25 dark:text-slate-300",
  pro: "bg-primary/10 text-primary ring-primary/25",
  max: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
};

function LicensesPage() {
  const list = useServerFn(listLicenseKeys);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    list()
      .then((r) => setRows(r.keys as Row[]))
      .catch((e) => toast.error((e as Error).message || "Failed to load licenses"))
      .finally(() => setLoading(false));
  }, [list]);

  const byTier = useMemo(() => {
    const map: Record<PlanTier, Row[]> = { starter: [], pro: [], max: [] };
    for (const r of rows) map[r.tier]?.push(r);
    return map;
  }, [rows]);

  function copy(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("License key copied");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="License Keys"
        description="30 pre-issued license keys — 10 Starter, 10 Pro, 10 Max. Hand any key to a customer school; the tier decides which modules that school unlocks. A single key may be reused across multiple deployments."
      />

      {loading ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-sm text-muted-foreground shadow-sm">
          Loading…
        </div>
      ) : (
        PLAN_TIERS.map((tier) => {
          const feature = PLAN_FEATURES[tier];
          const tierRows = byTier[tier];
          return (
            <div
              key={tier}
              className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
            >
              <div className="flex flex-col gap-2 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="size-4 text-primary" />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ${TIER_STYLES[tier]}`}
                  >
                    {feature.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {feature.tagline}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {tierRows.length} keys
                </div>
              </div>

              <div className="divide-y divide-border">
                {tierRows.map((r) => (
                  <div
                    key={r.key}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-display text-sm font-semibold">
                        {String(r.index).padStart(2, "0")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-semibold">{r.label}</div>
                        <code className="block truncate font-mono text-xs text-muted-foreground">
                          {r.key}
                        </code>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copy(r.key)}
                    >
                      <Copy className="mr-2 size-4" /> Copy
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
