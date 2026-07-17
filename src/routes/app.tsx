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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSession, setSession, subscribeSession, type SessionUser } from "@/lib/session";
import { logout as logoutFn } from "@/lib/auth.functions";

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
      { to: "/app/library", label: "Library", icon: BookOpen },
      { to: "/app/hostel", label: "Hostel", icon: HomeIcon },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/app/fees", label: "Fees", icon: Wallet },
      { to: "/app/accounts", label: "Accounts", icon: Landmark },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/app/id-cards", label: "ID Cards", icon: IdCard },
      { to: "/app/calendar", label: "Calendar", icon: Calendar },
      { to: "/app/notices", label: "Notice Board", icon: Megaphone },
      { to: "/app/reports", label: "Reports", icon: ClipboardList },
      { to: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Institute",
    items: [
      { to: "/app/roles", label: "Roles & Permissions", icon: UserCog },
      { to: "/app/website", label: "Public Website", icon: Globe },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

const superAdminNav: NavGroup = {
  label: "Platform",
  items: [{ to: "/app/tenants", label: "Schools (Tenants)", icon: Landmark }],
};

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(() => getSession()?.user ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    setUser(s?.user ?? null);
    setReady(true);
    if (!s) {
      navigate({ to: "/auth/login", search: { redirect: window.location.pathname } });
    }
    return subscribeSession((next) => setUser(next?.user ?? null));
  }, [nav]);

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
          {(user.isSuperAdmin ? [superAdminNav, ...nav] : nav).map((group) => (
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
