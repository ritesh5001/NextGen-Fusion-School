import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, LabelList,
} from "recharts";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getAcademicAnalytics } from "@/lib/analytics.functions";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsPage,
});

// Validated categorical palette (dataviz skill default theme, light-mode steps).
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
// Grade bands ordered best→worst with a sequential intent (green good → red fail).
const GRADE_COLORS: Record<string, string> = {
  "A+": "#008300", A: "#1baf7a", "B+": "#5aa9a0", B: "#eda100", C: "#eb6834", D: "#e87ba4", F: "#e34948",
};

type Academic = Awaited<ReturnType<typeof getAcademicAnalytics>>;

const TABS = [
  { key: "academic", label: "Academic" },
  { key: "attendance", label: "Attendance" },
  { key: "finance", label: "Finance" },
  { key: "enrollment", label: "Enrollment" },
] as const;

function AnalyticsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("academic");

  // Gate: admins + principal (reports.read). Others bounced to /app.
  const perms = getSession()?.user?.perms ?? [];
  const roleKeys = getSession()?.user?.roleKeys ?? [];
  const isSuper = getSession()?.user?.isSuperAdmin ?? false;
  const canView =
    isSuper || perms.includes("*") || perms.includes("reports.read") ||
    roleKeys.includes("admin") || roleKeys.includes("principal");
  useEffect(() => {
    if (!canView) navigate({ to: "/app" });
  }, [canView, navigate]);
  if (!canView) return null;

  return (
    <div className="p-8">
      <PageHeader
        title="Analytics"
        description="Institution-wide insights across academics, attendance, finance, and enrollment."
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "academic" && <AcademicTab />}
      {tab !== "academic" && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {TABS.find((t) => t.key === tab)?.label} analytics — coming in the next phase.
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Academic tab ---------------------------- */

function AcademicTab() {
  const load = useServerFn(getAcademicAnalytics);
  const [data, setData] = useState<Academic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading analytics…</div>;
  }
  if (!data || data.kpi.assessments === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        No exam marks recorded yet. Once exams are graded, academic insights appear here.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Average score" value={`${data.kpi.avgPercent}%`} tone="primary" />
        <Kpi label="Pass rate" value={`${data.kpi.passRate}%`} tone={data.kpi.passRate >= 75 ? "good" : "warn"} />
        <Kpi label="Assessments graded" value={data.kpi.assessments.toLocaleString("en-IN")} />
        <Kpi label="Absent in exams" value={`${data.kpi.absentRate}%`} tone={data.kpi.absentRate > 10 ? "warn" : "muted"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Grade distribution */}
        <Card title="Grade distribution" subtitle="Share of assessment results by grade band">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.gradeDistribution}
                dataKey="count"
                nameKey="grade"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={2}
                stroke="var(--card, #fff)"
              >
                {data.gradeDistribution.map((g) => (
                  <Cell key={g.grade} fill={GRADE_COLORS[g.grade] ?? "#94a3b8"} />
                ))}
                <LabelList dataKey="grade" position="outside" className="fill-foreground text-xs" />
              </Pie>
              <Tooltip content={<ChartTip unit=" results" />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Subject averages */}
        <Card title="Subject-wise average" subtitle="Mean score percentage by subject">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.subjectAverages} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="subject" width={110} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
              <Bar dataKey="avgPercent" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={18}>
                <LabelList dataKey="avgPercent" position="right" formatter={(v: number) => `${v}%`} className="fill-foreground text-[11px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Class comparison */}
        <Card title="Class comparison" subtitle="Average score percentage by class">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.classComparison} margin={{ top: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="className" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
              <Bar dataKey="avgPercent" fill={SERIES[2]} radius={[4, 4, 0, 0]} barSize={34}>
                <LabelList dataKey="avgPercent" position="top" formatter={(v: number) => `${v}%`} className="fill-foreground text-[11px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Exam trend */}
        <Card title="Performance trend" subtitle="Average score across exams over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.examTrend} margin={{ top: 16, right: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="exam" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTip unit="%" />} />
              <Line type="monotone" dataKey="avgPercent" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, fill: SERIES[1] }}>
                <LabelList dataKey="avgPercent" position="top" formatter={(v: number) => `${v}%`} className="fill-foreground text-[11px]" />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top performers table */}
      <Card title="Top performers" subtitle="Highest average score across all graded subjects">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Roll</th>
                <th className="py-2 pr-4 font-medium">Class</th>
                <th className="py-2 pr-4 font-medium text-right">Average</th>
              </tr>
            </thead>
            <tbody>
              {data.topPerformers.map((p, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-4 font-medium">{p.name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{p.rollNo ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{p.className ?? "—"}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-primary">{p.avgPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------- primitives ---------------------------- */

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" | "good" | "warn" | "muted" }) {
  const toneClass =
    tone === "primary" ? "text-primary" :
    tone === "good" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warn" ? "text-amber-600 dark:text-amber-400" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <GraduationCap className="size-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label, unit = "" }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{p.payload.grade ?? p.payload.subject ?? p.payload.className ?? p.payload.exam ?? label}</div>
      <div className="text-muted-foreground">
        {p.value}
        {unit}
      </div>
    </div>
  );
}
