import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { issueLicense, getIssuerStatus } from "@/lib/license-issue.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/licenses")({
  component: LicensesPage,
});

function LicensesPage() {
  const issue = useServerFn(issueLicense);
  const status = useServerFn(getIssuerStatus);
  const [hasKeys, setHasKeys] = useState<null | { hasPrivateKey: boolean; hasPublicKey: boolean }>(
    null,
  );
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxStudents, setMaxStudents] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");

  useEffect(() => {
    status().then(setHasKeys).catch(() => setHasKeys({ hasPrivateKey: false, hasPublicKey: false }));
  }, [status]);

  async function onIssue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setKey("");
    try {
      const res = await issue({
        data: {
          institution,
          email,
          expiresAt: expiresAt || null,
          maxStudents: Number(maxStudents) || 0,
          features: ["*"],
        },
      });
      setKey(res.licenseKey);
      toast.success("License issued");
    } catch (e) {
      const msg = e instanceof Response ? await e.text() : (e as Error).message;
      toast.error(msg || "Failed to issue license");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="License Manager"
        description="Generate signed license keys for schools. Each key is bound to the school's owner email — registration on their deployment is gated on this key."
      />


      {hasKeys && !hasKeys.hasPrivateKey && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="font-medium text-destructive">Signing key not configured</div>
          <p className="mt-1 text-muted-foreground">
            Add <code className="text-xs">LICENSE_PRIVATE_KEY</code> and{" "}
            <code className="text-xs">LICENSE_PUBLIC_KEY</code> as environment secrets on this
            deployment, then reload. Only this vendor deployment needs the private key — schools
            only need the public key to verify.
          </p>
        </div>
      )}

      <form
        onSubmit={onIssue}
        className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inst">School / Institution name</Label>
            <Input
              id="inst"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="em">School owner email</Label>
            <Input
              id="em"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp">Expires on (blank = perpetual)</Label>
            <Input
              id="exp"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Max students (0 = unlimited)</Label>
            <Input
              id="max"
              type="number"
              min={0}
              value={maxStudents}
              onChange={(e) => setMaxStudents(Number(e.target.value))}
            />
          </div>
        </div>

        <Button type="submit" disabled={busy || (hasKeys && !hasKeys.hasPrivateKey)}>
          {busy ? "Signing…" : "Generate license key"}
        </Button>
      </form>

      {key && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-sm font-semibold">Generated license key</div>
              <p className="text-xs text-muted-foreground">
                Send this to the school. They paste it on their /setup page.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(key);
                toast.success("Copied");
              }}
            >
              <Copy className="mr-2 size-4" /> Copy
            </Button>
          </div>
          <Textarea readOnly value={key} rows={4} className="font-mono text-xs" />
        </div>
      )}
    </div>
  );
}
