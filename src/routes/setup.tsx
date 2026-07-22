import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInstallStatus, runSetup } from "@/lib/setup.functions";
import { login } from "@/lib/auth.functions";
import { setSession } from "@/lib/session";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First-time setup — NextGen Fusion School" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function SetupPage() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [schoolName, setSchoolName] = useState("");
  const [schoolSlug, setSchoolSlug] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getInstallStatus()
      .then((s) => {
        if (s.installed) nav({ to: "/auth/login" });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [nav]);

  useEffect(() => {
    if (!schoolSlug || schoolSlug === slugify(schoolName.slice(0, schoolName.length - 1))) {
      setSchoolSlug(slugify(schoolName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await runSetup({
        data: {
          schoolName,
          schoolSlug,
          ownerEmail: email,
          ownerPassword: pwd,
          ownerFirstName: first,
          ownerLastName: last || undefined,
        },
      });
      // Auto-sign the owner in and take them to the dashboard.
      const res = await login({ data: { email, password: pwd } });
      setSession(res);
      nav({ to: "/app" });
    } catch (e) {
      const msg = e instanceof Response ? await e.text() : (e as Error).message;
      setErr(msg || "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Checking installation…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2">
            <span className="size-7 rounded-md bg-primary" />
            <span className="font-display text-lg font-semibold tracking-tight">
              NextGen Fusion School
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            First-time setup — takes about a minute.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5"
        >
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Your institution
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              This name and identifier appear on your reports, ID cards, and public site.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="sn">School / College name</Label>
              <Input id="sn" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="ss">Short identifier</Label>
              <Input
                id="ss"
                value={schoolSlug}
                onChange={(e) => setSchoolSlug(e.target.value.toLowerCase())}
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Used in URLs. Lowercase letters, numbers, and dashes only.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">Owner account</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This account has full access. You can add more admins later.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fn">First name</Label>
              <Input id="fn" value={first} onChange={(e) => setFirst(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln">Last name</Label>
              <Input id="ln" value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                minLength={8}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">Minimum 8 characters.</p>
            </div>
          </div>

          {err && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Setting up…" : "Complete setup"}
          </Button>
        </form>
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
