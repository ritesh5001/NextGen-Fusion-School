import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { login, logout as logoutFn } from "@/lib/auth.functions";
import { getSession, setSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/auth/lock")({
  component: LockScreen,
  head: () => ({
    meta: [
      { title: "Locked — NextGen Fusion School" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function LockScreen() {
  const nav = useNavigate();
  const loginFn = useServerFn(login);
  const logoutServerFn = useServerFn(logoutFn);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantSlug, setTenantSlug] = useState<string | undefined>();

  useEffect(() => {
    const s = getSession();
    if (!s) {
      nav({ to: "/auth/login" });
      return;
    }
    const u = s.user;
    setDisplayName([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);
    setEmail(u.email);
    setTenantSlug(u.tenant?.slug);
  }, [nav]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const res = (await loginFn({
        data: { email, password, tenantSlug },
      })) as {
        accessToken: string;
        refreshToken: string;
        user: import("@/lib/session").SessionUser;
      };
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      toast.success("Unlocked");
      nav({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message || "Invalid password");
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/15">
            <Lock className="size-5 text-primary" />
          </div>
          <h1 className="font-display text-lg font-semibold">Session locked</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayName ? `Welcome back, ${displayName}` : "Enter your password to continue"}
          </p>
        </div>
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </form>
        <button
          onClick={signOut}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Not you? Sign in with another account
        </button>
      </div>
    </div>
  );
}
