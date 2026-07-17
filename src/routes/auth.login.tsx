import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { login } from "@/lib/auth.functions";
import { setSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const search = z.object({
  redirect: z.string().optional(),
  tenant: z.string().optional(),
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

function LoginPage() {
  const nav = useNavigate();
  const s = useSearch({ from: "/auth/login" });
  const [tenantSlug, setTenantSlug] = useState(s.tenant ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({
        data: {
          email,
          password,
          tenantSlug: superAdmin ? undefined : tenantSlug || undefined,
        },
      });
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
        <div className="border border-border rounded-2xl bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Access your school's workspace.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {!superAdmin && (
              <div className="space-y-2">
                <Label htmlFor="tenant">School slug</Label>
                <Input
                  id="tenant"
                  placeholder="e.g. sunrise-academy"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  required={!superAdmin}
                  autoComplete="organization"
                />
              </div>
            )}
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
                <Link
                  to="/auth/forgot"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
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

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={superAdmin}
                onChange={(e) => setSuperAdmin(e.target.checked)}
              />
              Sign in as platform super admin
            </label>

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
