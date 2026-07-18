import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { getInstallStatus } from "@/lib/setup.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NextGen Fusion School" },
      {
        name: "description",
        content:
          "A complete school management system — students, teachers, attendance, exams, fees, HR, payroll, hostel, library, and more.",
      },
      { property: "og:title", content: "NextGen Fusion School" },
      {
        property: "og:description",
        content: "A complete, modern school ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const features = [
  "Admissions",
  "Students",
  "Teachers",
  "Attendance",
  "Exams & Marks",
  "Promotion",
  "Fees",
  "Accounts",
  "HRM",
  "Payroll",
  "Hostel",
  "Library",
  "ID Cards",
  "Calendar",
  "Notice Board",
  "Reports",
  "Notifications",
  "Public Website",
  "Roles & ACL",
  "Academic Year",
  "Classes & Sections",
  "Subjects",
  "Online Portal",
  "Settings",
];

function Home() {
  const [name, setName] = useState("NextGen Fusion School");
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    getInstallStatus()
      .then((s) => {
        setInstalled(s.installed);
        if (s.institution?.name) setName(s.institution.name);
      })
      .catch(() => setInstalled(true));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="size-6 rounded-md bg-primary" />
            <span className="font-display text-sm font-semibold tracking-tight">{name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {installed === false ? (
              <Link to="/setup" className="text-primary font-medium">
                Complete setup →
              </Link>
            ) : (
              <Link to="/auth/login" className="text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Complete school management, on your infrastructure
            </div>
            <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
              Run your entire school{" "}
              <span className="text-primary">from one place.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Admissions, attendance, exams, fees, HR, payroll, hostel, library — every module
              your institution needs, in a single modern workspace.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to={installed === false ? "/setup" : "/auth/login"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                {installed === false ? "Get started" : "Sign in to workspace"}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#modules"
                className="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:border-border-strong"
              >
                See what's inside
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Modules grid */}
      <section id="modules" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Everything your institution runs on
            </h2>
            <p className="mt-3 text-muted-foreground">
              A single workspace with the modules a modern school actually uses — no
              plugins, no add-ons.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
            {features.map((f, i) => (
              <div key={f} className="flex items-center gap-3 bg-card p-4">
                <span className="text-[11px] font-mono text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <ShieldCheck className="size-5 text-primary" />
              <h3 className="mt-3 font-display text-lg font-semibold">Your data, your server</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Deployed on your infrastructure. Your database. Your backups.
              </p>
            </div>
            <div>
              <GraduationCap className="size-5 text-primary" />
              <h3 className="mt-3 font-display text-lg font-semibold">Built for schools</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every module tuned to the way Indian schools actually work.
              </p>
            </div>
            <div>
              <Sparkles className="size-5 text-primary" />
              <h3 className="mt-3 font-display text-lg font-semibold">Modern & fast</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Type-safe TypeScript stack. Loads instantly. Ages well.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
          <Link to="/auth/login" className="hover:text-foreground">Staff sign in</Link>
        </div>
      </footer>
    </div>
  );
}
