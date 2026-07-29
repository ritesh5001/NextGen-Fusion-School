import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarCheck,
  FileSpreadsheet,
  Wallet,
  Landmark,
  UserCog,
  BookOpen,
  Home as HomeIcon,
  IdCard,
  Calendar,
  Megaphone,
  ClipboardList,
  Bell,
  Globe,
  Settings,
  Search,
  ChevronDown,
  LogOut,
  Wrench,
  Lock,
  Palette,
  Sparkles,
  BarChart3,
  ArrowRight,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSession, setSession, subscribeSession, type SessionUser } from "@/lib/session";
import { logout as logoutFn } from "@/lib/auth.functions";
import { getLicenseStatus } from "@/lib/license.functions";
import { listStudents } from "@/lib/students.functions";
import {
  toPlanTier,
  planAllowsPath,
  minPlanFor,
  PLAN_LABELS,
  PLAN_FEATURES,
  nextPlan,
  type PlanTier,
} from "@/lib/plans";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const nav: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { to: "/app/students", label: "Students", icon: Users },
      { to: "/app/teachers", label: "Teachers", icon: GraduationCap },
      { to: "/app/hrm", label: "HRM", icon: UserCog },
    ],
  },
  {
    label: "Academic",
    items: [
      { to: "/app/academic-years", label: "Academic Years", icon: Calendar },
      { to: "/app/classes", label: "Classes & Sections", icon: BookOpen },
      { to: "/app/subjects", label: "Subjects", icon: BookOpen },
      { to: "/app/attendance", label: "Attendance", icon: CalendarCheck },
      { to: "/app/exams", label: "Exams & Marks", icon: FileSpreadsheet },
      { to: "/app/marks", label: "Marks Entry", icon: FileSpreadsheet },
      { to: "/app/grades", label: "Grade Scales", icon: FileSpreadsheet },
      { to: "/app/promotion", label: "Promotion", icon: GraduationCap },
      { to: "/app/library", label: "Library", icon: BookOpen },
      { to: "/app/hostel", label: "Hostel", icon: HomeIcon },

    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/app/fees", label: "Fees", icon: Wallet },
      { to: "/app/payroll", label: "Payroll", icon: Wallet },
      { to: "/app/accounts", label: "Accounts", icon: Landmark },
    ],
  },

  {
    label: "Operations",
    items: [
      { to: "/app/id-cards", label: "ID Cards", icon: IdCard },
      { to: "/app/calendar", label: "Calendar", icon: Calendar },
      { to: "/app/notices", label: "Notice Board", icon: Megaphone },
      { to: "/app/admissions", label: "Online Admissions", icon: ClipboardList },
      { to: "/app/reports", label: "Reports", icon: ClipboardList },
      { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Institute",
    items: [
      { to: "/app/users", label: "Users & Access", icon: Users },
      { to: "/app/roles", label: "Roles & Permissions", icon: UserCog },
      { to: "/app/website", label: "Public Website", icon: Globe },
      { to: "/app/appearance", label: "Appearance", icon: Palette },
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/profile", label: "My Profile", icon: UserCog },
      // Note: Developer Utilities and License Manager are intentionally omitted
      // here — they are super-admin (developer) only and live in superAdminNav.
    ],
  },

];

// Super-admin (vendor / platform operator) only needs licensing + platform utilities.
// School-operational modules (students, teachers, fees, etc.) are hidden.
const superAdminNav: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Platform",
    items: [
      { to: "/app/licenses", label: "License Manager", icon: IdCard },
      { to: "/app/users", label: "Users & Access", icon: Users },
      { to: "/app/roles", label: "Roles & Permissions", icon: UserCog },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/appearance", label: "Appearance", icon: Palette },
      { to: "/app/devops", label: "Developer Utilities", icon: Wrench },
      { to: "/app/profile", label: "My Profile", icon: UserCog },
    ],
  },
];

// Single-institution deployment: no platform tenant switcher.


function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(() => getSession()?.user ?? null);
  const [ready, setReady] = useState(false);
  const [license, setLicense] = useState<{ label: string; tone: "warn" | "error" } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [paletteOpen, setPaletteOpen] = useState(false); // ⌘K command palette

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // ⌘K / Ctrl-K opens the command palette anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const s = getSession();
    setUser(s?.user ?? null);
    setReady(true);
    if (!s) {
      navigate({ to: "/auth/login", search: { redirect: window.location.pathname } });
      return;
    }
    getLicenseStatus()
      .then((r) => {
        if (!r.installed) return;
        const st = r.status;
        if (!r.hasKey) {
          setLicense({ label: "No license key installed — activate under Settings → License.", tone: "warn" });
        } else if (!st?.valid) {
          setLicense({ label: `License invalid: ${st?.reason ?? "unknown"} — data is read-only until renewed.`, tone: "error" });
        } else if (st.expiresInDays != null && st.expiresInDays <= 30) {
          setLicense({ label: `License / AMC expires in ${st.expiresInDays} day${st.expiresInDays === 1 ? "" : "s"}. Renew soon.`, tone: "warn" });
        }
      })
      .catch(() => {});
    return subscribeSession((next) => setUser(next?.user ?? null));
  }, [navigate]);

  async function handleLogout() {
    const s = getSession();
    try {
      if (s?.refreshToken) await logoutFn({ data: { refreshToken: s.refreshToken } });
    } catch {
      /* ignore */
    }
    setSession(null);
    navigate({ to: "/auth/login" });
  }

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const roleLabel = user.isSuperAdmin ? "Super admin" : user.tenant?.name ?? "Member";
  const schoolName = user.tenant?.name ?? "Platform";

  // Entitlement tier for this school (from the activated license key). Super
  // admins are the vendor operator and are never plan-gated.
  const plan = toPlanTier(user.tenant?.plan);
  const gated = !user.isSuperAdmin;
  const routeLocked = gated && !planAllowsPath(plan, pathname);

  return (
    <div className="flex min-h-screen w-full bg-surface-muted">
      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on md+, slide-in drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <span className="size-6 rounded-md bg-primary" />
          <span className="font-display text-sm font-semibold tracking-tight">NextGen Fusion School</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-md p-1.5 text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-sidebar-border p-3">
          <button className="flex w-full items-center justify-between rounded-md bg-sidebar-accent px-3 py-2 text-left text-xs transition hover:bg-accent">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">School</div>
              <div className="mt-0.5 truncate text-sm font-medium text-sidebar-foreground">{schoolName}</div>
            </div>
            {gated && (
              <span className="ml-2 shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/25">
                {PLAN_LABELS[plan]}
              </span>
            )}
            <ChevronDown className="size-4 text-sidebar-muted" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {(user.isSuperAdmin ? superAdminNav : nav).map((group) => (
            <div key={group.label} className="mb-4">
              <div className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-muted">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  const Icon = item.icon;
                  const itemLocked = gated && !planAllowsPath(plan, item.to);
                  if (itemLocked) {
                    const need = minPlanFor(item.to);
                    return (
                      <Link
                        key={item.to}
                        to="/app/upgrade"
                        title={`Available on the ${PLAN_LABELS[need]} plan — click to upgrade`}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto flex items-center gap-1">
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                            {PLAN_LABELS[need]}
                          </span>
                          <Lock className="size-3 shrink-0" />
                        </span>
                      </Link>
                    );
                  }
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {gated && plan !== "max" && (
          <div className="px-3 pb-1">
            <Link
              to="/app/upgrade"
              className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs font-semibold text-primary ring-1 ring-primary/25 transition hover:bg-primary/15"
            >
              <Sparkles className="size-4 shrink-0" />
              <span>Upgrade plan</span>
              <ArrowRight className="ml-auto size-4" />
            </Link>
          </div>
        )}

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary ring-1 ring-primary/30">
              {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{displayName}</div>
              <div className="truncate text-[10px] text-sidebar-muted">{roleLabel}</div>
            </div>
            <button
              onClick={() => navigate({ to: "/auth/lock" })}
              title="Lock screen"
              className="rounded-md p-1.5 text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Lock className="size-4" />
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-md p-1.5 text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:gap-4 md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Search — opens the command palette */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="relative flex w-full max-w-md items-center gap-2 rounded-md border border-input bg-surface-muted py-2 pr-3 pl-9 text-left text-sm text-muted-foreground outline-none transition hover:border-ring/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <span className="truncate">Search students, staff, invoices…</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <ThemeToggle />
            <button
              onClick={() => navigate({ to: "/app/notifications" })}
              className="rounded-md p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </button>
            <button
              onClick={() => navigate({ to: "/app/profile" })}
              className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-primary/30"
              title={displayName}
              aria-label="My profile"
            >
              {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {license && (
            <div
              className={`border-b px-4 py-2 text-xs font-medium md:px-8 ${
                license.tone === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
            >
              {license.label}
            </div>
          )}
          {routeLocked ? (
            <UpgradePanel plan={plan} path={pathname} />
          ) : (
            <Outlet />
          )}
          <footer className="border-t border-border bg-background px-4 py-3 md:px-8">
            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>
                © {new Date().getFullYear()} {schoolName}. Licensed to NextGen Fusion School.
              </span>
              <span>
                Developed by{" "}
                <a
                  href="https://nextgenfusion.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  NextGen Fusion
                </a>
              </span>
            </div>
          </footer>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={user.isSuperAdmin ? superAdminNav : nav}
      />
    </div>
  );
}

/** Shown when a school opens a module its current plan doesn't include. */
function UpgradePanel({ plan, path }: { plan: PlanTier; path: string }) {
  const required = minPlanFor(path);
  const target = PLAN_FEATURES[required];
  const upgradeTo = nextPlan(plan);
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-6" />
        </div>
        <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">
          {target.label} plan required
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This module isn&apos;t part of your <strong>{PLAN_LABELS[plan]}</strong>{" "}
          plan. {target.tagline}
        </p>
        <ul className="mt-5 space-y-2 text-left text-sm">
          {target.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-muted-foreground">{h}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to="/app/upgrade"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            See upgrade options <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/app/settings"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-muted"
          >
            Activate a license key
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {upgradeTo
            ? `Upgrade to the ${PLAN_LABELS[upgradeTo]} plan or higher to unlock this module.`
            : "Activate a license key that includes this module."}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------- Theme toggle ---------------------------- */

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("sms.theme.mode", next ? "dark" : "light");
    } catch {
      /* storage unavailable — the toggle still works for this session */
    }
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="rounded-md p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/* -------------------------- Command palette (⌘K) -------------------------- */

type PaletteResult = {
  id: string;
  label: string;
  sub?: string;
  to: string;
  kind: "page" | "student" | "staff";
};

function CommandPalette({
  open,
  onClose,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<PaletteResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const searchStudents = useServerFn(listStudents);

  // Reset each time it opens.
  useEffect(() => {
    if (open) {
      setQ("");
      setPeople([]);
      setCursor(0);
    }
  }, [open]);

  // Debounced people search once the query is meaningful.
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setPeople([]);
      return;
    }
    const t = setTimeout(() => {
      searchStudents({ data: { query: q.trim(), page: 1, pageSize: 8 } })
        .then((r) => {
          const rows = (r as { rows: Array<Record<string, unknown>> }).rows ?? [];
          setPeople(
            rows.map((s) => ({
              id: String(s.id),
              label: [s.firstName, s.lastName].filter(Boolean).join(" "),
              sub: [s.admissionNo, s.className].filter(Boolean).join(" · "),
              to: "/app/students",
              kind: "student" as const,
            })),
          );
        })
        .catch(() => setPeople([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, searchStudents]);

  // Flatten nav into searchable page results.
  const pages: PaletteResult[] = groups.flatMap((g) =>
    g.items.map((i) => ({
      id: i.to,
      label: i.label,
      sub: g.label,
      to: i.to,
      kind: "page" as const,
    })),
  );
  const term = q.trim().toLowerCase();
  const matchedPages = term
    ? pages.filter((p) => p.label.toLowerCase().includes(term) || (p.sub ?? "").toLowerCase().includes(term))
    : pages.slice(0, 8);
  const results = [...matchedPages, ...people];

  function go(r: PaletteResult) {
    onClose();
    navigate({ to: r.to });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      go(results[cursor]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, students…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{q}”.
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => go(r)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                  i === cursor ? "bg-accent text-accent-foreground" : "hover:bg-surface-muted"
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase ${
                    r.kind === "student"
                      ? "bg-primary/15 text-primary"
                      : "bg-surface-muted text-muted-foreground"
                  }`}
                >
                  {r.kind === "student" ? "S" : "›"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.label}</span>
                  {r.sub && <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
