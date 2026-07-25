import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { UpgradeNudge } from "@/components/upgrade";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { formatCurrencyCompact } from "@/lib/currency";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/app/")({
  component: DashboardOverview,
});

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

function fmtDate(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function DashboardOverview() {
  const load = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const schoolName = getSession()?.user?.tenant?.name ?? "Your institution";

  useEffect(() => {
    load()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const kpis = [
    {
      label: "Total students",
      value: stats ? stats.studentCount.toLocaleString("en-IN") : "—",
    },
    { label: "Staff", value: stats ? stats.staffCount.toLocaleString("en-IN") : "—" },
    {
      label: "Fees collected",
      value: stats ? formatCurrencyCompact(stats.feesCollected) : "—",
    },
    {
      label: "Attendance today",
      value:
        stats && stats.attendancePct != null ? `${stats.attendancePct}%` : "—",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{schoolName}</p>
        </div>
      </div>

      <UpgradeNudge
        requiredPlan="pro"
        feature="Exam results, report cards, online admissions and analytics"
        className="mb-8"
      />

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-6">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {k.label}
            </div>
            <div className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {loading ? "…" : k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent admissions */}
        <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-sm font-semibold">Recent admissions</h3>
            <a
              href="/app/admissions"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
            >
              View all <ArrowUpRight className="size-3" />
            </a>
          </div>
          {!loading && stats && stats.recentAdmissions.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No admission applications yet.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Applicant</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(stats?.recentAdmissions ?? []).map((r) => (
                  <tr key={r.id} className="transition hover:bg-surface-muted/50">
                    <td className="px-6 py-4 text-sm font-medium">{r.name.trim()}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{fmtDate(r.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Upcoming events */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold">Upcoming events</h3>
          {!loading && stats && stats.upcomingEvents.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            <div className="mt-6 space-y-5">
              {(stats?.upcomingEvents ?? []).map((e) => {
                const dt = new Date(e.startDate);
                return (
                  <div key={e.id} className="flex gap-4">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-accent">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-accent-foreground">
                        {dt.toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                      <span className="text-sm font-semibold text-accent-foreground">
                        {dt.getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      {e.location && (
                        <div className="truncate text-xs text-muted-foreground">{e.location}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
