import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Plus } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: DashboardOverview,
});

const kpis = [
  { label: "Total students", value: "1,482", delta: "+12% vs LY", tone: "success" as const },
  { label: "Staff", value: "94", delta: "4 vacancies", tone: "muted" as const },
  { label: "Fees collected", value: "₹42.1L", delta: "88% of target", tone: "success" as const },
  { label: "Attendance", value: "96.4%", delta: "Daily avg", tone: "muted" as const },
];

const admissions = [
  { name: "Arjun Sharma", cls: "Grade 9-B", date: "Oct 12", status: "PAID" },
  { name: "Isha Gupta", cls: "Grade 2-A", date: "Oct 11", status: "PENDING" },
  { name: "Rohan Verma", cls: "Grade 12-C", date: "Oct 10", status: "PAID" },
  { name: "Meera Iyer", cls: "Grade 6-B", date: "Oct 9", status: "PAID" },
];

const events = [
  { d: "15", m: "Oct", title: "Diwali break begins", meta: "Holiday period" },
  { d: "18", m: "Oct", title: "Annual sports meet", meta: "Main ground · 9:00 AM" },
  { d: "22", m: "Oct", title: "Parent-teacher meeting", meta: "Virtual · Class 1–5" },
  { d: "28", m: "Oct", title: "Term 1 exam begins", meta: "All grades" },
];

function DashboardOverview() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Academic year 2024–25 · Delhi Public School, Meerut</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-primary/20 transition hover:opacity-90">
          <Plus className="size-4" /> Quick action
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-6">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</div>
            <div className="mt-2 font-display text-3xl font-semibold tracking-tight">{k.value}</div>
            <div
              className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${
                k.tone === "success" ? "text-success" : "text-muted-foreground"
              }`}
            >
              {k.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent admissions */}
        <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-sm font-semibold">Recent admissions</h3>
            <button className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80">
              View all <ArrowUpRight className="size-3" />
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Student</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Class</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admissions.map((r) => (
                <tr key={r.name} className="transition hover:bg-surface-muted/50">
                  <td className="px-6 py-4 text-sm font-medium">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{r.cls}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{r.date}</td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === "PAID" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upcoming events */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold">Upcoming events</h3>
          <div className="mt-6 space-y-5">
            {events.map((e) => (
              <div key={e.title} className="flex gap-4">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-accent">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-accent-foreground">{e.m}</span>
                  <span className="text-sm font-semibold text-accent-foreground">{e.d}</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{e.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This is the Phase 0 dashboard shell. Next phase wires up Postgres, JWT auth, multi-tenancy, and the first real modules.
        </p>
      </div>
    </div>
  );
}
