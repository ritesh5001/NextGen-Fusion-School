import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: MarketingHome,
});

const modules = [
  { n: "01", name: "Admissions" },
  { n: "02", name: "Students" },
  { n: "03", name: "Teachers" },
  { n: "04", name: "Attendance" },
  { n: "05", name: "Exams & Marks" },
  { n: "06", name: "Promotion" },
  { n: "07", name: "Fees" },
  { n: "08", name: "Accounts" },
  { n: "09", name: "HRM" },
  { n: "10", name: "Payroll" },
  { n: "11", name: "Hostel" },
  { n: "12", name: "Library" },
  { n: "13", name: "ID Cards" },
  { n: "14", name: "Calendar" },
  { n: "15", name: "Notice Board" },
  { n: "16", name: "Reports" },
  { n: "17", name: "Notifications" },
  { n: "18", name: "Public Website" },
  { n: "19", name: "Roles & ACL" },
  { n: "20", name: "Multi-tenant" },
  { n: "21", name: "Academic Year" },
  { n: "22", name: "Classes & Sections" },
  { n: "23", name: "Subjects" },
  { n: "24", name: "Online Portal" },
  { n: "25", name: "Settings" },
  { n: "26", name: "Dev Utilities" },
];

const plans = [
  {
    name: "Basic",
    price: "₹500",
    period: "per month",
    tagline: "Core academics for small schools.",
    features: ["Up to 300 students", "Students & Teachers", "Classes, Sections, Subjects", "Attendance & Exams", "Basic reports"],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹1,000",
    period: "per month",
    tagline: "The complete operations suite.",
    features: ["Up to 1,500 students", "Everything in Basic", "Fees, Accounts & Ledger", "HRM, Payroll & Leave", "Hostel, Library, ID cards", "Notice board & calendar"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Max",
    price: "₹1,500",
    period: "per month",
    tagline: "For growing multi-branch groups.",
    features: ["Unlimited students", "Everything in Pro", "Public website & CMS", "Online admission portal", "Multi-language & GA", "Priority support"],
    cta: "Talk to sales",
    highlight: false,
  },
];

function MarketingHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="size-6 rounded-md bg-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">ScholarFlow</span>
        </Link>
        <div className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#modules" className="hover:text-foreground">Modules</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#customers" className="hover:text-foreground">Customers</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/app" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">Sign in</Link>
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm ring-1 ring-primary/20 transition hover:opacity-90"
          >
            Start free trial <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> 26 modules · one platform · from ₹500/mo
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            The operating system for modern Indian schools.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            From admissions to attendance, fees to payroll, hostels to ID cards — run every part of your school in one calm, unified interface.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/app"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground ring-1 ring-primary/20 transition hover:opacity-90 sm:w-auto"
            >
              Start free trial <ArrowRight className="size-4" />
            </Link>
            <button className="inline-flex w-full items-center justify-center rounded-md border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground transition hover:bg-surface-muted sm:w-auto">
              Watch 2-min demo
            </button>
          </div>

          {/* Dashboard preview panel */}
          <div className="mt-20 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-3">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="ml-3 text-xs text-muted-foreground">app.scholarflow.in/dashboard</span>
            </div>
            <div className="grid grid-cols-4 gap-px bg-border">
              {[
                { k: "Students", v: "1,482", d: "+12% YoY" },
                { k: "Staff", v: "94", d: "4 vacancies" },
                { k: "Fees collected", v: "₹42.1L", d: "88% of target" },
                { k: "Attendance", v: "96.4%", d: "Daily average" },
              ].map((kpi) => (
                <div key={kpi.k} className="bg-card p-6 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{kpi.k}</div>
                  <div className="mt-1 font-display text-3xl font-semibold">{kpi.v}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-success">{kpi.d}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-px bg-border">
              <div className="col-span-2 bg-card p-6 text-left">
                <div className="text-sm font-semibold">Recent admissions</div>
                <div className="mt-4 space-y-3 text-sm">
                  {[
                    { n: "Arjun Sharma", c: "Grade 9-B", s: "PAID" },
                    { n: "Isha Gupta", c: "Grade 2-A", s: "PENDING" },
                    { n: "Rohan Verma", c: "Grade 12-C", s: "PAID" },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                      <div>
                        <div className="font-medium">{r.n}</div>
                        <div className="text-xs text-muted-foreground">{r.c}</div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.s === "PAID" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{r.s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-card p-6 text-left">
                <div className="text-sm font-semibold">Upcoming</div>
                <div className="mt-4 space-y-4 text-sm">
                  {[
                    { d: "15", m: "Oct", t: "Diwali break begins" },
                    { d: "18", m: "Oct", t: "Annual sports meet" },
                    { d: "22", m: "Oct", t: "Parent-teacher meet" },
                  ].map((e) => (
                    <div key={e.d} className="flex gap-3">
                      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded bg-accent">
                        <span className="text-[9px] font-bold uppercase text-accent-foreground">{e.m}</span>
                        <span className="text-sm font-semibold text-accent-foreground">{e.d}</span>
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-foreground">{e.t}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div id="customers" className="mt-16 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm font-semibold tracking-wider text-muted-foreground opacity-60">
            <span>DELHI PUBLIC SCHOOL</span>
            <span>DOON ACADEMY</span>
            <span>MODERN INTL.</span>
            <span>ST. XAVIER'S</span>
            <span>RYAN GROUP</span>
          </div>
        </div>
      </header>

      {/* Modules */}
      <section id="modules" className="border-b border-border bg-surface-muted py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-primary">The Platform</div>
              <h2 className="mt-2 font-display text-4xl font-medium tracking-tight">One platform, 26 modules.</h2>
            </div>
            <p className="hidden max-w-sm text-sm text-muted-foreground md:block">
              Every operational surface a school needs, built to talk to each other. No spreadsheets. No stitched-together tools.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4 lg:grid-cols-6">
            {modules.map((m) => (
              <div key={m.n} className="flex flex-col gap-2 bg-card p-5 transition hover:bg-accent/40">
                <div className="size-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{m.n}</span>
                <span className="text-sm font-medium">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-border py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</div>
            <h2 className="mt-2 font-display text-4xl font-medium tracking-tight">Priced for Indian schools.</h2>
            <p className="mt-3 text-muted-foreground">One flat monthly fee per school. No per-student pricing. 14-day free trial.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl p-8 ${
                  p.highlight ? "bg-card ring-2 ring-primary shadow-xl shadow-primary/10" : "bg-card ring-1 ring-border"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 right-8 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-8 w-full rounded-md px-4 py-2.5 text-sm font-medium transition ${
                    p.highlight
                      ? "bg-primary text-primary-foreground ring-1 ring-primary/20 hover:opacity-90"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="border-b border-border bg-surface-muted py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="font-display text-2xl font-medium leading-relaxed tracking-tight text-balance md:text-3xl">
            "ScholarFlow replaced four tools we were paying for. Admissions, fees, and exam reports now take a fraction of the time — and parents finally get a modern portal."
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 text-sm">
            <div className="size-10 rounded-full bg-primary/20 ring-1 ring-primary/30" />
            <div className="text-left">
              <div className="font-semibold">Dr. Anjali Sharma</div>
              <div className="text-muted-foreground">Principal, Delhi Public School (Meerut)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-4xl font-medium tracking-tight md:text-5xl">Ready in a weekend. Priced like a utility.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Try ScholarFlow free for 14 days. No card required. Bring your existing data — we'll help you migrate.</p>
          <Link
            to="/app"
            className="mt-8 inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground ring-1 ring-primary/20 transition hover:opacity-90"
          >
            Start free trial <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="size-4 rounded bg-primary" />
            <span>© {new Date().getFullYear()} ScholarFlow. Made in India.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
