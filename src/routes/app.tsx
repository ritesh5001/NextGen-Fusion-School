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
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import { getSession, setSession, subscribeSession, type SessionUser } from "@/lib/session";
import { logout as logoutFn } from "@/lib/auth.functions";
import { getLicenseStatus } from "@/lib/license.functions";

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
      { to: "/app/devops", label: "Developer Utilities", icon: Wrench },
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

  return (
    <div className="flex min-h-screen w-full bg-surface-muted">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <span className="size-6 rounded-md bg-primary" />
          <span className="font-display text-sm font-semibold tracking-tight">NextGen Fusion School</span>
        </div>

        <div className="border-b border-sidebar-border p-3">
          <button className="flex w-full items-center justify-between rounded-md bg-sidebar-accent px-3 py-2 text-left text-xs transition hover:bg-accent">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">School</div>
              <div className="mt-0.5 truncate text-sm font-medium text-sidebar-foreground">{schoolName}</div>
            </div>
            <ChevronDown className="size-4 text-sidebar-muted" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {nav.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-muted">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  const Icon = item.icon;
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
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-8 backdrop-blur">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search students, staff, invoices..."
              className="w-full rounded-md border border-input bg-surface-muted py-2 pr-3 pl-9 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="rounded-md p-2 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">
              <Bell className="size-4" />
            </button>
            <div className="ml-2 size-8 rounded-full bg-primary/20 ring-1 ring-primary/30" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {license && (
            <div
              className={`border-b px-8 py-2 text-xs font-medium ${
                license.tone === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
            >
              {license.label}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
