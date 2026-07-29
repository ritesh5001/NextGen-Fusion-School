import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Phone, Mail, MapPin, User } from "lucide-react";
import { getStudentProfile } from "@/lib/students.functions";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/datetime";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/app/students/$id")({
  component: StudentProfile,
});

type Profile = Awaited<ReturnType<typeof getStudentProfile>>;

function StudentProfile() {
  const { id } = Route.useParams();
  const load = useServerFn(getStudentProfile);
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load({ data: { id } })
      .then(setData)
      .catch((e) => setError(e instanceof Response ? "Student not found" : (e as Error).message));
  }, [load, id]);

  if (error) {
    return (
      <div className="p-8">
        <BackLink />
        <div className="mt-6 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-8">
        <BackLink />
        <div className="mt-6 animate-pulse space-y-4">
          <div className="h-28 rounded-xl bg-muted" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-24 rounded-xl bg-muted" />
            <div className="h-24 rounded-xl bg-muted" />
            <div className="h-24 rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const s = data.student;
  const name = `${s.firstName} ${s.lastName ?? ""}`.trim();

  return (
    <div className="p-8">
      <BackLink />

      {/* Header card */}
      <div className="mt-4 flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center">
        <Avatar className="size-20 shrink-0">
          <AvatarImage src={s.photoUrl ?? undefined} alt="" />
          <AvatarFallback className="text-xl">
            {(s.firstName[0] ?? "").toUpperCase()}{(s.lastName?.[0] ?? "").toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{name}</h1>
            <Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{s.admissionNo}</span>
            {s.rollNo && <span>Roll #{s.rollNo}</span>}
            {s.className && <span>{s.className}{s.sectionName ? ` – ${s.sectionName}` : ""}</span>}
            {s.gender && <span className="capitalize">{s.gender}</span>}
            {s.dob && <span>DOB {formatDate(s.dob)}</span>}
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Attendance" value={data.attendance.pct != null ? `${data.attendance.pct}%` : "—"}
          sub={`${data.attendance.present}/${data.attendance.total} days present`}
          tone={data.attendance.pct != null && data.attendance.pct >= 85 ? "good" : "warn"} />
        <Stat label="Fees paid" value={formatCurrency(data.fees.paid)}
          sub={data.fees.outstanding > 0 ? `${formatCurrency(data.fees.outstanding)} outstanding` : "Fully paid"}
          tone={data.fees.outstanding > 0 ? "warn" : "good"} />
        <Stat label="Assessments" value={String(data.results.length)}
          sub="graded subject results" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contact & guardian */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Contact &amp; guardian</h3>
          <dl className="space-y-3 text-sm">
            <Field icon={User} label="Guardian" value={s.guardianName} />
            <Field icon={Phone} label="Guardian phone" value={s.guardianPhone} />
            <Field icon={Mail} label="Guardian email" value={s.guardianEmail} />
            <Field icon={Phone} label="Student phone" value={s.phone} />
            <Field icon={Mail} label="Student email" value={s.email} />
            <Field icon={MapPin} label="Address" value={s.address} />
          </dl>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Recent results</h3>
          {data.results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No exam results recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Exam</th>
                    <th className="py-2 pr-4 font-medium">Subject</th>
                    <th className="py-2 pr-4 text-right font-medium">Marks</th>
                    <th className="py-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4">{r.exam}</td>
                      <td className="py-2 pr-4 font-medium">{r.subject}</td>
                      <td className="py-2 pr-4 text-right font-mono">
                        {r.absent ? <span className="text-destructive">Absent</span> : `${r.obtained}/${r.max}`}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {r.pct != null ? `${r.pct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/app/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
      <ArrowLeft className="size-4" /> Back to students
    </Link>
  );
}

function Stat({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "warn" }) {
  const c = tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${c}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium">{value || "—"}</dd>
      </div>
    </div>
  );
}
