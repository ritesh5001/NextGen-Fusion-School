import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, Tooltip,
} from "recharts";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { UpgradeNudge } from "@/components/upgrade";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { formatCurrencyCompact } from "@/lib/currency";
import { getSession, setSession } from "@/lib/session";

const inrCompact = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${n}`;

export const Route = createFileRoute("/app/")({
  component: DashboardOverview,
});

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

function fmtDate(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function DashboardOverview() {
  const navigate = useNavigate();
  const load = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const session = getSession();
  const schoolName = session?.user?.tenant?.name ?? "Your institution";
  const perms = session?.user?.perms ?? [];
  const roleKeys = session?.user?.roleKeys ?? [];
  const canViewAnalytics =
    (session?.user?.isSuperAdmin ?? false) || perms.includes("*") ||
    perms.includes("reports.read") || roleKeys.includes("admin") || roleKeys.includes("principal");

  useEffect(() => {
    load()
      .then(setStats)
      .catch((err) => {
        // A 401 means the stored session token is no longer valid (e.g. after a
        // secret rotation). Clear it and send the user to sign in again instead
        // of leaving a broken dashboard.
        if (err instanceof Response && err.status === 401) {
          setSession(null);
          navigate({ to: "/auth/login", search: { redirect: "/app" } });
        }
      })
      .finally(() => setLoading(false));
  }, [load, navigate]);

  // Defensive: a stats object may arrive with missing fields (e.g. a failed or
  // partial server response), so guard each value rather than assuming it exists.
  const kpis = [
    {
      label: "Total students",
      value:
        stats?.studentCount != null
          ? stats.studentCount.toLocaleString("en-IN")
          : "—",
    },
    {
      label: "Staff",
      value:
        stats?.staffCount != null
          ? stats.staffCount.toLocaleString("en-IN")
          : "—",
    },
    {
      label: "Fees collected",
      value:
        stats?.feesCollected != null
          ? formatCurrencyCompact(stats.feesCollected)
          : "—",
    },
    {
      label: "Attendance today",
      value:
        stats?.attendancePct != null ? `${stats.attendancePct}%` : "—",
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

      {/* At-a-glance analytics */}
      {!loading && stats && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">At a glance</h2>
            {canViewAnalytics && (
              <Link to="/app/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80">
                <BarChart3 className="size-3.5" /> Full analytics <ArrowUpRight className="size-3" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Enrollment by class */}
            <MiniCard title="Enrollment by class">
              {stats.enrollmentByClass.length ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={stats.enrollmentByClass} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                    <XAxis dataKey="className" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" tickFormatter={(v: string) => v.replace("Class ", "")} />
                    <Tooltip content={<MiniTip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
                    <Bar dataKey="count" fill="#2a78d6" radius={[3, 3, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <MiniEmpty />}
            </MiniCard>

            {/* Fee collection */}
            <MiniCard title="Fee collection">
              {stats.feeSplit.collected + stats.feeSplit.outstanding > 0 ? (
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width="55%" height={140}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Collected", value: stats.feeSplit.collected },
                          { name: "Outstanding", value: stats.feeSplit.outstanding },
                        ]}
                        dataKey="value" innerRadius={34} outerRadius={58} paddingAngle={2} strokeWidth={2} stroke="var(--card, #fff)"
                      >
                        <Cell fill="#008300" />
                        <Cell fill="#eda100" />
                      </Pie>
                      <Tooltip content={<MiniTip money />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#008300]" /> Collected <span className="font-semibold">{inrCompact(stats.feeSplit.collected)}</span></li>
                    <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#eda100]" /> Outstanding <span className="font-semibold">{inrCompact(stats.feeSplit.outstanding)}</span></li>
                  </ul>
                </div>
              ) : <MiniEmpty />}
            </MiniCard>

            {/* Attendance trend */}
            <MiniCard title="Attendance (last 7 days)">
              {stats.attendanceTrend.length ? (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={stats.attendanceTrend} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashAtt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#008300" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#008300" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                    <Tooltip content={<MiniTip unit="%" />} />
                    <Area type="monotone" dataKey="pct" stroke="#008300" strokeWidth={2} fill="url(#dashAtt)" dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <MiniEmpty />}
            </MiniCard>
          </div>
        </div>
      )}

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

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function MiniEmpty() {
  return (
    <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">
      No data yet
    </div>
  );
}

function MiniTip({ active, payload, unit = "", money = false }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = p.payload.className ?? p.payload.date ?? p.name ?? "";
  const val = money ? "₹" + Number(p.value).toLocaleString("en-IN") : `${p.value}${unit}`;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {name && <div className="font-medium">{name}</div>}
      <div className="text-muted-foreground">{val}</div>
    </div>
  );
}
