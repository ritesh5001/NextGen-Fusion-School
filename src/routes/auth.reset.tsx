import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { resetPassword } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/reset")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Set new password — ScholarFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const { token } = useSearch({ from: "/auth/reset" });
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) return setErr("Missing token");
    if (pw !== pw2) return setErr("Passwords do not match");
    if (pw.length < 8) return setErr("Password must be at least 8 characters");
    setLoading(true);
    try {
      await resetPassword({ data: { token, password: pw } });
      setOk(true);
      setTimeout(() => nav({ to: "/auth/login" }), 1500);
    } catch (e) {
      const msg = e instanceof Response ? await e.text() : (e as Error).message;
      setErr(msg || "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-border rounded-2xl bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        {ok ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Password updated. Redirecting to sign in…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Confirm password</Label>
              <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            </div>
            {err && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </Button>
            <div className="text-sm text-center">
              <Link to="/auth/login" className="text-muted-foreground hover:text-foreground">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
