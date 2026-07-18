import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyStudentProfile,
  getMyAttendance,
  getMyResults,
  getMyFees,
} from "@/lib/portal.functions";
import { getSession, setSession } from "@/lib/session";
import { logout as logoutFn } from "@/lib/auth.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GraduationCap, LogOut, Calendar, Wallet, FileSpreadsheet, User } from "lucide-react";

export const Route = createFileRoute("/portal")({
  component: PortalPage,
  head: () => ({
    meta: [
      { title: "Student Portal — NextGen Fusion School" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Profile = {
  student: {
    id: string;
    admissionNo: string;
    rollNo: string | null;
    firstName: string;
    lastName: string | null;
    gender: string | null;
    dob: string | Date | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    photoUrl: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    className: string | null;
    sectionName: string | null;
    yearName: string | null;
  };
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  fee: { total: number; paid: number; invoices: number };
} | null;

type AttRow = { date: string; status: string; note: string | null };
type ResultRow = {
  examId: string;
  examName: string;
  term: string | null;
  isPublished: boolean;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  passMarks: number;
  marksObtained: number | null;
  isAbsent: boolean;
};
type FeeRow = {
  id: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
};

type Tab = "overview" | "attendance" | "results" | "fees";

function PortalPage() {
  const nav = useNavigate();
  const getProfile = useServerFn(getMyStudentProfile);
  const getAtt = useServerFn(getMyAttendance);
  const getResults = useServerFn(getMyResults);
  const getFees = useServerFn(getMyFees);
  const logoutServerFn = useServerFn(logoutFn);

  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile>(null);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getSession()) {
      nav({ to: "/auth/login", search: { redirect: "/portal" } });
      return;
    }
    (async () => {
      try {
        const p = (await getProfile()) as Profile;
        setProfile(p);
        if (!p) toast.error("Your account is not linked to a student profile.");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setReady(true);
      }
    })();
  }, [getProfile, nav]);

  useEffect(() => {
    if (!profile) return;
    if (tab === "attendance") {
      getAtt({ data: {} }).then((r) => setAttendance(r as AttRow[])).catch(() => {});
    } else if (tab === "results") {
      getResults().then((r) => setResults(r as ResultRow[])).catch(() => {});
    } else if (tab === "fees") {
      getFees().then((r) => setFees(r as FeeRow[])).catch(() => {});
    }
  }, [tab, profile, getAtt, getResults, getFees]);

  async function signOut() {
    const s = getSession();
    try {
      if (s?.refreshToken) await logoutServerFn({ data: { refreshToken: s.refreshToken } });
    } catch {
      /* ignore */
    }
    setSession(null);
    nav({ to: "/auth/login" });
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="font-display text-lg font-semibold">No student profile linked</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask your school admin to link your account to a student record.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button onClick={signOut}>
              <LogOut className="mr-1 size-4" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const s = profile.student;
  const attPct =
    profile.attendance.total === 0
      ? 0
      : Math.round((profile.attendance.present / profile.attendance.total) * 100);
  const feeDue = profile.fee.total - profile.fee.paid;

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <div className="font-display text-sm font-semibold">Student Portal</div>
              <div className="text-xs text-muted-foreground">
                {s.firstName} {s.lastName} · Adm #{s.admissionNo}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1 size-4" /> Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-6">
          {(
            [
              { k: "overview", label: "Overview", icon: User },
              { k: "attendance", label: "Attendance", icon: Calendar },
              { k: "results", label: "Results", icon: FileSpreadsheet },
              { k: "fees", label: "Fees", icon: Wallet },
            ] as { k: Tab; label: string; icon: typeof User }[]
          ).map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === k
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Full name">
                  {s.firstName} {s.lastName ?? ""}
                </Field>
                <Field label="Admission no">{s.admissionNo}</Field>
                <Field label="Roll no">{s.rollNo ?? "—"}</Field>
                <Field label="Class / Section">
                  {[s.className, s.sectionName].filter(Boolean).join(" · ") || "—"}
                </Field>
                <Field label="Academic year">{s.yearName ?? "—"}</Field>
                <Field label="Gender">{s.gender ?? "—"}</Field>
                <Field label="Phone">{s.phone ?? "—"}</Field>
                <Field label="Email">{s.email ?? "—"}</Field>
                <Field label="Guardian">
                  {s.guardianName ?? "—"}
                  {s.guardianPhone ? ` · ${s.guardianPhone}` : ""}
                </Field>
                <Field label="Address">{s.address ?? "—"}</Field>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <StatCard label="Attendance" value={`${attPct}%`}
                sub={`${profile.attendance.present}/${profile.attendance.total} present`}
              />
              <StatCard
                label="Fees due"
                value={`₹${feeDue.toLocaleString("en-IN")}`}
                sub={`${profile.fee.invoices} invoice(s)`}
                accent={feeDue > 0 ? "warning" : "ok"}
              />
            </div>
          </div>
        )}

        {tab === "attendance" && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.note ?? ""}</TableCell>
                    </TableRow>
                  ))}
                  {attendance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                        No attendance recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "results" && (
          <Card>
            <CardHeader>
              <CardTitle>Published results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Marks</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => {
                    const pass =
                      !r.isAbsent && (r.marksObtained ?? 0) >= r.passMarks;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          {r.examName}
                          {r.term ? <span className="ml-1 text-xs text-muted-foreground">· {r.term}</span> : null}
                        </TableCell>
                        <TableCell>{r.subjectName}</TableCell>
                        <TableCell className="text-right">
                          {r.isAbsent ? "AB" : (r.marksObtained ?? "—")}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.maxMarks}</TableCell>
                        <TableCell className="text-right">
                          {r.isAbsent ? (
                            <Badge variant="secondary">Absent</Badge>
                          ) : pass ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Pass</Badge>
                          ) : (
                            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400">Fail</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No published results yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "fees" && (
          <Card>
            <CardHeader>
              <CardTitle>Fee invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Issue date</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.invoiceNo}</TableCell>
                      <TableCell>{r.issueDate}</TableCell>
                      <TableCell>{r.dueDate}</TableCell>
                      <TableCell className="text-right">
                        ₹{r.totalAmount.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{r.paidAmount.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{(r.totalAmount - r.paidAmount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "paid" ? "default" : "secondary"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {fees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        No invoices yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "ok" | "warning";
}) {
  const accentClass =
    accent === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : accent === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 font-display text-2xl font-semibold ${accentClass}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    absent: "bg-red-500/15 text-red-700 dark:text-red-400",
    late: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    excused: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  };
  return <Badge className={map[status] ?? ""}>{status}</Badge>;
}
