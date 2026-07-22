import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listLicenseKeys } from "@/lib/license-issue.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Copy, KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/licenses")({
  component: LicensesPage,
});

type Row = { index: number; key: string; label: string; notes?: string };

function LicensesPage() {
  const list = useServerFn(listLicenseKeys);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    list()
      .then((r) => setRows(r.keys))
      .catch((e) => toast.error((e as Error).message || "Failed to load licenses"))
      .finally(() => setLoading(false));
  }, [list]);

  function copy(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("License key copied");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="License Keys"
        description="The 20 pre-issued license keys for NextGen Fusion School. Hand any of these to a customer school — a single key may be reused across multiple deployments."
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <div className="font-display text-sm font-semibold">
              {rows.length} license keys available
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Reusable — one key can activate multiple schools
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
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
        )}
      </div>
    </div>
  );
}
