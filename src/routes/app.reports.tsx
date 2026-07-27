import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getReportsSummary } from "@/lib/reports.functions";
import { PageHeader } from "@/components/page-header";
import {
  Users,
  GraduationCap,
  UserCog,
  BookOpen,
  Wallet,
  Landmark,
  Home as HomeIcon,
  ClipboardList,
  CalendarCheck,
  FileSpreadsheet,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

type Summary = {
  students: { total: number; active: number };
  teachers: number;
  employees: number;
  classes: number;
  sections: number;
  fees: {
    billed: number;
    paid: number;
    due: number;
    invoices: number;
    collections: number;
  };
  ledger: { income: number; expense: number; net: number };
  library: { issued: number; overdue: number };
  hostel: { active: number };
  admissions: { pending: number; approved: number };
};

const reportLinks: {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    to: "/app/students",
    label: "Student roster",
    description: "Filter by class, section, and status",
    icon: Users,
  },
  {
    to: "/app/teachers",
    label: "Teacher directory",
    description: "Faculty with subject assignments",
    icon: GraduationCap,
  },
  {
    to: "/app/hrm",
    label: "Employee list",
    description: "Staff, leave balances, off-site logs",
    icon: UserCog,
  },
  {
    to: "/app/attendance",
    label: "Attendance report",
    description: "Daily and monthly for students & employees",
    icon: CalendarCheck,
  },
  {
    to: "/app/marks",
    label: "Marksheet & results",
    description: "GPA, ranks, exam-wise analysis",
    icon: FileSpreadsheet,
  },
  {
    to: "/app/fees",
    label: "Fee due report",
    description: "Outstanding invoices and collections",
    icon: Wallet,
  },
  {
    to: "/app/accounts",
    label: "Ledger",
    description: "Income, expense, and net position",
    icon: Landmark,
  },
  {
    to: "/app/library",
    label: "Library records",
    description: "Issued, overdue, and lost books",
    icon: BookOpen,
  },
  {
    to: "/app/hostel",
    label: "Hostel occupancy",
    description: "Room capacity and allocations",
    icon: HomeIcon,
  },
  {
    to: "/app/admissions",
    label: "Admission pipeline",
    description: "Applications by status",
    icon: ClipboardList,
  },
];

function ReportsPage() {
  const getFn = useServerFn(getReportsSummary);
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    getFn().then((r) => setS(r as Summary));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Reports"
        description="Institution-wide snapshot and quick jumps to every module"
        action={
          <Link
            to="/app/analytics"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <BarChart3 className="size-4" /> Open Analytics <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      {s && (
        <>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              People
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Students" value={s.students.total} sub={`${s.students.active} active`} />
              <Stat label="Teachers" value={s.teachers} />
              <Stat label="Employees" value={s.employees} />
              <Stat label="Classes" value={s.classes} />
              <Stat label="Sections" value={s.sections} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Finance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Fees billed" value={`₹${s.fees.billed.toLocaleString()}`} sub={`${s.fees.invoices} invoices`} />
              <Stat label="Fees collected" value={`₹${s.fees.paid.toLocaleString()}`} />
              <Stat label="Fees due" value={`₹${s.fees.due.toLocaleString()}`} tone={s.fees.due > 0 ? "warn" : undefined} />
              <Stat
                label="Ledger net"
                value={`₹${s.ledger.net.toLocaleString()}`}
                sub={`In ₹${s.ledger.income.toLocaleString()} · Out ₹${s.ledger.expense.toLocaleString()}`}
                tone={s.ledger.net < 0 ? "warn" : undefined}
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Operations
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Books issued" value={s.library.issued} sub={s.library.overdue ? `${s.library.overdue} overdue` : "0 overdue"} tone={s.library.overdue ? "warn" : undefined} />
              <Stat label="Hostel occupied" value={s.hostel.active} />
              <Stat label="Applications pending" value={s.admissions.pending} tone={s.admissions.pending ? "warn" : undefined} />
              <Stat label="Applications approved" value={s.admissions.approved} />
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Detailed reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reportLinks.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="border rounded-lg p-4 hover:border-primary/40 hover:bg-muted/30 transition group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition">
                  <r.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r.description}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-2xl font-semibold mt-1 ${
          tone === "warn" ? "text-amber-600" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
