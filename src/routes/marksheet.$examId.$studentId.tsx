import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicMarksheet } from "@/lib/marks.functions";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/marksheet/$examId/$studentId")({
  component: MarksheetPage,
  head: () => ({
    meta: [
      { title: "Marksheet — NextGen Fusion School" },
      {
        name: "description",
        content: "Official examination marksheet.",
      },
    ],
  }),
});

type Data = Awaited<ReturnType<typeof getPublicMarksheet>>;

function MarksheetPage() {
  const { examId, studentId } = Route.useParams();
  const fn = useServerFn(getPublicMarksheet);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = (await fn({ data: { examId, studentId } })) as Data;
        setData(res);
      } catch (e) {
        setErr(
          e instanceof Response
            ? await e.text().catch(() => "Not available")
            : (e as Error).message,
        );
      }
    })();
  }, [fn, examId, studentId]);

  if (err) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-8">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold">Marksheet unavailable</h1>
          <p className="text-sm text-muted-foreground">{err}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading marksheet…
      </div>
    );
  }

  const stuName = [data.student.firstName, data.student.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-h-screen bg-muted py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <a href="/" className="text-sm text-muted-foreground hover:underline">
            ← Home
          </a>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Printer className="size-4" /> Print / Save PDF
          </button>
        </div>

        <div className="rounded-lg border-2 border-foreground/10 bg-card p-10 shadow-sm print:border print:shadow-none">
          {/* Header */}
          <div className="mb-8 border-b-2 border-foreground/80 pb-6 text-center">
            {data.tenant?.logoUrl && (
              <img
                src={data.tenant.logoUrl}
                alt=""
                className="mx-auto mb-3 h-14 object-contain"
              />
            )}
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {data.tenant?.name ?? "School"}
            </h1>
            {data.settings?.address && (
              <p className="mt-1 text-xs text-muted-foreground">
                {data.settings.address}
              </p>
            )}
            {data.settings?.motto && (
              <p className="mt-1 text-[11px] italic text-muted-foreground">
                {data.settings.motto}
              </p>
            )}
            <div className="mt-4 inline-block border-y border-foreground/40 px-6 py-1 text-sm font-semibold uppercase tracking-widest">
              {data.exam.name} {data.exam.term ? `— ${data.exam.term}` : ""} · Marksheet
            </div>
          </div>

          {/* Student meta */}
          <div className="mb-8 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <MetaRow label="Student" value={stuName} />
            <MetaRow label="Admission #" value={data.student.admissionNo} />
            <MetaRow label="Roll #" value={data.student.rollNo ?? "—"} />
            <MetaRow label="Class" value={data.student.className ?? "—"} />
            <MetaRow label="Section" value={data.student.sectionName ?? "—"} />
            <MetaRow
              label="Exam period"
              value={
                data.exam.startsOn
                  ? `${data.exam.startsOn} → ${data.exam.endsOn ?? "—"}`
                  : "—"
              }
            />
          </div>

          {/* Marks table */}
          <table className="mb-8 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y-2 border-foreground/80 bg-muted/40 text-left">
                <th className="p-3 text-xs uppercase tracking-wider">Subject</th>
                <th className="p-3 text-right text-xs uppercase tracking-wider">Max</th>
                <th className="p-3 text-right text-xs uppercase tracking-wider">Pass</th>
                <th className="p-3 text-right text-xs uppercase tracking-wider">Obtained</th>
                <th className="p-3 text-center text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No subjects mapped for this class.
                  </td>
                </tr>
              ) : (
                data.subjects.map((s, i) => (
                  <tr key={i} className="border-b border-foreground/10">
                    <td className="p-3 font-medium">{s.subjectName}</td>
                    <td className="p-3 text-right">{s.maxMarks}</td>
                    <td className="p-3 text-right">{s.passMarks}</td>
                    <td className="p-3 text-right font-semibold">
                      {s.isAbsent ? "AB" : (s.marksObtained ?? "—")}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          s.isAbsent
                            ? "bg-muted text-muted-foreground"
                            : s.pass
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-red-500/15 text-red-700"
                        }`}
                      >
                        {s.isAbsent ? "ABSENT" : s.pass ? "PASS" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/80 font-semibold">
                <td className="p-3">Total</td>
                <td className="p-3 text-right">{data.totalMax}</td>
                <td className="p-3"></td>
                <td className="p-3 text-right">{data.totalObtained}</td>
                <td className="p-3 text-center">{data.percent.toFixed(2)}%</td>
              </tr>
            </tfoot>
          </table>

          {/* Summary */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <SummaryCard label="Percentage" value={`${data.percent.toFixed(2)}%`} />
            <SummaryCard
              label="Grade"
              value={data.grade}
              hint={data.gpa ? `GPA ${data.gpa}` : undefined}
            />
            <SummaryCard
              label="Result"
              value={data.status}
              tone={
                data.status === "PASS"
                  ? "success"
                  : data.status === "FAIL"
                    ? "danger"
                    : "muted"
              }
            />
          </div>

          {/* Sign line */}
          <div className="mt-16 grid grid-cols-3 gap-6 text-center text-xs">
            <SignLine label="Class Teacher" />
            <SignLine label="Examination In-Charge" />
            <SignLine label="Principal" />
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground print:hidden">
          This is a system-generated marksheet from NextGen Fusion School.
        </p>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger" | "muted";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : tone === "danger"
        ? "border-red-500/40 bg-red-500/5"
        : "border-foreground/10 bg-muted/30";
  return (
    <div className={`rounded-lg border p-4 text-center ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SignLine({ label }: { label: string }) {
  return (
    <div>
      <div className="mx-auto mb-1 h-px w-32 bg-foreground/40" />
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
