import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPlatformPublicKey, issueLicense } from "@/lib/license-issue.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, KeyRound, ShieldCheck } from "lucide-react";
import { PLAN_TIERS, PLAN_FEATURES, type PlanTier } from "@/lib/plans";

export const Route = createFileRoute("/app/licenses")({
  component: LicensesPage,
});

function LicensesPage() {
  const getPub = useServerFn(getPlatformPublicKey);
  const issue = useServerFn(issueLicense);

  const [publicKey, setPublicKey] = useState<string>("");
  const [institution, setInstitution] = useState("");
  const [slug, setSlug] = useState("");
  const [tier, setTier] = useState<PlanTier>("pro");
  const [issued, setIssued] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPub()
      .then((r) => setPublicKey(r.publicKey))
      .catch((e) => toast.error((e as Error).message || "Failed to load signing key"));
  }, [getPub]);

  async function onIssue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setIssued("");
    try {
      const r = await issue({ data: { institution, slug: slug || undefined, tier } });
      setIssued(r.licenseKey);
      setPublicKey(r.publicKey);
      toast.success("License key issued");
    } catch (err) {
      const msg = err instanceof Response ? await err.text() : (err as Error).message;
      toast.error(msg || "Failed to issue license");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="License Issuer"
        description="Sign a new license key for a customer school. Keys are signed with the platform private key held on this server — customers can verify but never forge or self-issue one."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={onIssue}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h2 className="font-display text-sm font-semibold">Issue a key</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inst">Institution name</Label>
            <Input
              id="inst"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="St. Xavier's High School"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Bind to school identifier (optional)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="st-xaviers"
              pattern="[a-z0-9-]+"
            />
            <p className="text-[11px] text-muted-foreground">
              If set, the key can only be activated on a school with this exact
              identifier (tenant binding). Leave blank for an unbound key.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Plan tier</Label>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition ${
                    tier === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-muted"
                  }`}
                >
                  {PLAN_FEATURES[t].label}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={busy || !institution.trim()}>
            {busy ? "Signing…" : "Issue license key"}
          </Button>
        </form>

        <div className="space-y-4">
          {issued && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">New license key</h3>
                <Button size="sm" variant="outline" onClick={() => copy(issued, "License key")}>
                  <Copy className="mr-2 size-4" /> Copy
                </Button>
              </div>
              <code className="block break-all rounded-md bg-background p-3 font-mono text-xs">
                {issued}
              </code>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Hand this to the customer to paste during setup or under
                Settings → Deployment license.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h3 className="font-display text-sm font-semibold">Public verification key</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Set this as <code className="font-mono">LICENSE_PUBLIC_KEY</code> in each
              customer&apos;s <code className="font-mono">.env</code> so their deployment can
              verify keys offline.
            </p>
            <div className="flex items-center gap-2">
              <code className="block flex-1 break-all rounded-md bg-surface-muted p-3 font-mono text-xs">
                {publicKey || "…"}
              </code>
              {publicKey && (
                <Button size="sm" variant="outline" onClick={() => copy(publicKey, "Public key")}>
                  <Copy className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
