import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, LabelList,
} from "recharts";
import { Area, AreaChart } from "recharts";
import { GraduationCap, CalendarCheck, Wallet, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  getAcademicAnalytics,
  getAttendanceAnalytics,
  getFinanceAnalytics,
  getEnrollmentAnalytics,
} from "@/lib/analytics.functions";
import { getSession } from "@/lib/session";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const inrCompact = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${n}`;
const STATUS_COLORS: Record<string, string> = {
  Present: "#008300", Absent: "#e34948", Late: "#eda100", Excused: "#2a78d6",
  Paid: "#008300", Partial: "#eda100", Unpaid: "#e34948",
};

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
      {tab === "attendance" && <AttendanceTab />}
      {tab === "finance" && <FinanceTab />}
      {tab === "enrollment" && <EnrollmentTab />}
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
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.gradeDistribution}
                  dataKey="count"
                  nameKey="grade"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke="var(--card, #fff)"
                >
                  {data.gradeDistribution.map((g) => (
                    <Cell key={g.grade} fill={GRADE_COLORS[g.grade] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTip unit=" results" />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend — grade identity is never color-alone */}
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-1">
              {[...data.gradeDistribution]
                .sort((a, b) => ["A+","A","B+","B","C","D","F"].indexOf(a.grade) - ["A+","A","B+","B","C","D","F"].indexOf(b.grade))
                .map((g) => {
                  const total = data.gradeDistribution.reduce((s, x) => s + x.count, 0) || 1;
                  return (
                    <li key={g.grade} className="flex items-center gap-2">
                      <span className="inline-block size-2.5 rounded-sm" style={{ background: GRADE_COLORS[g.grade] ?? "#94a3b8" }} />
                      <span className="font-medium">{g.grade}</span>
                      <span className="text-muted-foreground">
                        {g.count} · {Math.round((g.count / total) * 100)}%
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
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

function Card({ title, subtitle, icon: Icon = GraduationCap, children }: { title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ---------------------------- Attendance tab ---------------------------- */

function AttendanceTab() {
  const load = useServerFn(getAttendanceAnalytics);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAttendanceAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { load().then(setData).catch(() => {}).finally(() => setLoading(false)); }, [load]);

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading analytics…</div>;
  if (!data || data.kpi.total === 0) return <Empty msg="No attendance recorded yet." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Overall present" value={`${data.kpi.presentPct}%`} tone={data.kpi.presentPct >= 90 ? "good" : "warn"} />
        <Kpi label="Days recorded" value={String(data.kpi.days)} />
        <Kpi label="Total records" value={data.kpi.total.toLocaleString("en-IN")} tone="muted" />
        <Kpi label="Absent + late" value={`${(data.kpi.breakdown[1].count + data.kpi.breakdown[2].count).toLocaleString("en-IN")}`} tone="warn" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Daily attendance trend" subtitle="Present % per recorded day" icon={CalendarCheck}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.dailyTrend} margin={{ top: 12, right: 12 }}>
              <defs>
                <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#008300" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#008300" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTip unit="%" />} />
              <Area type="monotone" dataKey="pct" stroke="#008300" strokeWidth={2} fill="url(#attGrad)" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Status breakdown" subtitle="Present / absent / late / excused" icon={CalendarCheck}>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.kpi.breakdown} dataKey="count" nameKey="status" innerRadius={52} outerRadius={88} paddingAngle={2} strokeWidth={2} stroke="var(--card, #fff)">
                  {data.kpi.breakdown.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-1">
              {data.kpi.breakdown.map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: STATUS_COLORS[s.status] }} />
                  <span className="font-medium">{s.status}</span>
                  <span className="text-muted-foreground">{s.count.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card title="Attendance by class" subtitle="Present % per class" icon={CalendarCheck}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byClass} margin={{ top: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="className" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
              <Bar dataKey="pct" fill="#2a78d6" radius={[4, 4, 0, 0]} barSize={34}>
                <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v}%`} className="fill-foreground text-[11px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Chronic absentees" subtitle="Lowest attendance (min 3 records)" icon={CalendarCheck}>
          <SimpleTable
            head={["Student", "Class", "Absent", "Present %"]}
            rows={data.chronicAbsentees.map((c) => [c.name, c.className ?? "—", `${c.absentDays}/${c.days}`, `${c.presentPct}%`])}
            emptyMsg="No absentees — perfect attendance!"
          />
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------- Finance tab ---------------------------- */

function FinanceTab() {
  const load = useServerFn(getFinanceAnalytics);
  const [data, setData] = useState<Awaited<ReturnType<typeof getFinanceAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { load().then(setData).catch(() => {}).finally(() => setLoading(false)); }, [load]);

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading analytics…</div>;
  if (!data || data.kpi.invoices === 0) return <Empty msg="No fee invoices yet." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total billed" value={inrCompact(data.kpi.billed)} />
        <Kpi label="Collected" value={inrCompact(data.kpi.collected)} tone="good" />
        <Kpi label="Outstanding" value={inrCompact(data.kpi.outstanding)} tone={data.kpi.outstanding > 0 ? "warn" : "muted"} />
        <Kpi label="Collection rate" value={`${data.kpi.collectionRate}%`} tone={data.kpi.collectionRate >= 80 ? "good" : "warn"} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Monthly collection" subtitle="Payments received per month" icon={Wallet}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.monthly} margin={{ top: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tickFormatter={inrCompact} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={52} />
              <Tooltip content={<ChartTip money />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
              <Bar dataKey="amount" fill="#008300" radius={[4, 4, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Invoice status" subtitle="Paid / partial / unpaid" icon={Wallet}>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.statusSplit} dataKey="count" nameKey="status" innerRadius={52} outerRadius={88} paddingAngle={2} strokeWidth={2} stroke="var(--card, #fff)">
                  {data.statusSplit.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="grid grid-cols-1 gap-y-1.5 text-xs">
              {data.statusSplit.map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: STATUS_COLORS[s.status] }} />
                  <span className="font-medium">{s.status}</span>
                  <span className="text-muted-foreground">{s.count} invoices</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card title="Collection by fee head" subtitle="Billed amount per fee type" icon={Wallet}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byHead} layout="vertical" margin={{ left: 8, right: 40 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis type="number" tickFormatter={inrCompact} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="head" width={100} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTip money />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
              <Bar dataKey="amount" fill="#2a78d6" radius={[0, 4, 4, 0]} barSize={18}>
                <LabelList dataKey="amount" position="right" formatter={inrCompact} className="fill-foreground text-[10px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top defaulters" subtitle="Highest outstanding balance" icon={Wallet}>
          <SimpleTable
            head={["Student", "Class", "Outstanding"]}
            rows={data.defaulters.map((d) => [d.name, d.className ?? "—", inr(d.outstanding)])}
            emptyMsg="No dues — everyone has paid!"
          />
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------- Enrollment tab ---------------------------- */

function EnrollmentTab() {
  const load = useServerFn(getEnrollmentAnalytics);
  const [data, setData] = useState<Awaited<ReturnType<typeof getEnrollmentAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { load().then(setData).catch(() => {}).finally(() => setLoading(false)); }, [load]);

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading analytics…</div>;
  if (!data || data.kpi.students === 0) return <Empty msg="No students enrolled yet." />;

  const GENDER_COLORS: Record<string, string> = { Male: "#2a78d6", Female: "#e87ba4", Other: "#eda100" };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Students" value={data.kpi.students.toLocaleString("en-IN")} tone="primary" />
        <Kpi label="Teachers" value={String(data.kpi.teachers)} />
        <Kpi label="Support staff" value={String(data.kpi.employees)} tone="muted" />
        <Kpi label="Student : teacher" value={`${data.kpi.ratio}:1`} tone={data.kpi.ratio <= 30 ? "good" : "warn"} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Students per class" subtitle="Active enrollment by class" icon={Users}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byClass} margin={{ top: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="className" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
              <Bar dataKey="count" fill="#2a78d6" radius={[4, 4, 0, 0]} barSize={34}>
                <LabelList dataKey="count" position="top" className="fill-foreground text-[11px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Gender distribution" subtitle="Active students by gender" icon={Users}>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.gender} dataKey="count" nameKey="label" innerRadius={52} outerRadius={88} paddingAngle={2} strokeWidth={2} stroke="var(--card, #fff)">
                  {data.gender.map((g) => <Cell key={g.label} fill={GENDER_COLORS[g.label] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="grid grid-cols-1 gap-y-1.5 text-xs">
              {data.gender.map((g) => (
                <li key={g.label} className="flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: GENDER_COLORS[g.label] }} />
                  <span className="font-medium">{g.label}</span>
                  <span className="text-muted-foreground">{g.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        {data.funnel.length > 0 && (
          <Card title="Admission funnel" subtitle="Applications by status" icon={Users}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.funnel} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="status" width={110} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} />
                <Bar dataKey="count" fill="#4a3aa7" radius={[0, 4, 4, 0]} barSize={20}>
                  <LabelList dataKey="count" position="right" className="fill-foreground text-[11px]" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

function SimpleTable({ head, rows, emptyMsg }: { head: string[]; rows: (string | number | null)[][]; emptyMsg: string }) {
  if (rows.length === 0) return <div className="py-8 text-center text-sm text-muted-foreground">{emptyMsg}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {head.map((h, i) => <th key={i} className={`py-2 pr-4 font-medium ${i === head.length - 1 ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {r.map((c, j) => <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-medium" : "text-muted-foreground"} ${j === r.length - 1 ? "text-right font-semibold text-foreground" : ""}`}>{c ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTip({ active, payload, label, unit = "", money = false }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pl = p.payload;
  const name = pl.grade ?? pl.subject ?? pl.className ?? pl.exam ?? pl.status ?? pl.head ?? pl.month ?? pl.date ?? pl.label ?? pl.method ?? label;
  const val = money ? "₹" + Number(p.value).toLocaleString("en-IN") : `${p.value}${unit}`;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{name}</div>
      <div className="text-muted-foreground">{val}</div>
    </div>
  );
}
