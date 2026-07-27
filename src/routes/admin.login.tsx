import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { login } from "@/lib/auth.functions";
import { getInstallStatus } from "@/lib/setup.functions";
import { setSession, type SessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const search = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/admin/login")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Admin sign in — NextGen Fusion School" },
      { name: "description", content: "Administrator sign in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

/** Role keys that are allowed to sign in through the admin portal. */
const ADMIN_ROLE_KEYS = ["admin", "principal", "accountant", "hr"];

function isAdminUser(user: SessionUser): boolean {
  if (user.isSuperAdmin) return true;
  const rk = user.roleKeys ?? [];
  return rk.some((k) => ADMIN_ROLE_KEYS.includes(k));
}

function AdminLoginPage() {
  const nav = useNavigate();
  const s = useSearch({ from: "/admin/login" });
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
      // Gate the admin portal: only admin-tier users may sign in here.
      if (!isAdminUser(res.user)) {
        setError("This account is not an administrator. Use the staff sign-in page.");
        return;
      }
      setSession(res);
      nav({ to: (s.redirect as "/app") ?? "/app" });
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
          <div className="flex items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Admin sign in</h1>
              <p className="text-sm text-muted-foreground">
                {institutionName ? `Manage ${institutionName}.` : "Administrator access only."}
              </p>
            </div>
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

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Not an administrator?{" "}
            <Link to="/auth/login" className="font-medium text-primary hover:underline">
              Staff &amp; student sign-in
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Developed by{" "}
          <a
            href="https://nextgenfusion.in"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            NextGen Fusion
          </a>
        </p>
      </div>
    </div>
  );
}
