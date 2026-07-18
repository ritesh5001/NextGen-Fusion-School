import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GraduationCap, Users, Briefcase, ShieldCheck } from "lucide-react";
import { login } from "@/lib/auth.functions";
import { getInstallStatus } from "@/lib/setup.functions";
import { setSession, type SessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const search = z.object({
  redirect: z.string().optional(),
  as: z.enum(["admin", "teacher", "student", "staff"]).optional(),
});

export const Route = createFileRoute("/auth/login")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in — NextGen Fusion School" },
      { name: "description", content: "Sign in to your school's NextGen Fusion School workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

type Portal = "admin" | "teacher" | "student" | "staff";

const PORTALS: { key: Portal; label: string; blurb: string; icon: typeof Users }[] = [
  { key: "admin", label: "Manager", blurb: "Admin, principal, accountant, HR", icon: ShieldCheck },
  { key: "teacher", label: "Teacher", blurb: "Classes, marks, attendance", icon: GraduationCap },
  { key: "student", label: "Student", blurb: "Profile, results, fees", icon: Users },
  { key: "staff", label: "Staff", blurb: "Librarian, hostel warden, support", icon: Briefcase },
];

function landingFor(user: SessionUser): "/portal" | "/app" {
  if (user.isSuperAdmin) return "/app";
  const rk = user.roleKeys ?? [];
  if (rk.includes("student") || rk.includes("parent")) return "/portal";
  return "/app";
}

function LoginPage() {
  const nav = useNavigate();
  const s = useSearch({ from: "/auth/login" });
  const [portal, setPortal] = useState<Portal>(s.as ?? "admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string>("");

  useEffect(() => {
    getInstallStatus()
      .then((st) => {
        if (!st.installed) {
          nav({ to: "/setup" });
        } else if (st.institution) {
          setInstitutionName(st.institution.name);
        }
      })
      .catch(() => {});
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ data: { email, password } });
      setSession(res);
      const fallback = landingFor(res.user);
      nav({ to: (s.redirect as "/app") ?? fallback });
    } catch (err) {
      const msg = err instanceof Response ? await err.text() : (err as Error).message;
      setError(msg || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {institutionName ? `Access ${institutionName}.` : "Access your workspace."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {PORTALS.map((p) => {
              const active = portal === p.key;
              const Icon = p.icon;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPortal(p.key)}
                  className={`rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background hover:border-border-strong"
                  }`}
                >
                  <Icon className="size-4 text-primary" />
                  <div className="mt-1.5 text-sm font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.blurb}</div>
                </button>
              );
            })}
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/auth/forgot" className="text-xs text-muted-foreground hover:text-foreground">
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
