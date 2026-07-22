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
import { CheckCircle2, Copy } from "lucide-react";

export const Route = createFileRoute("/app/licenses")({
  component: LicensesPage,
});

function LicensesPage() {
  const issue = useServerFn(issueLicense);
  const status = useServerFn(getIssuerStatus);
  const [publicKey, setPublicKey] = useState<string>("");
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxStudents, setMaxStudents] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [issuedFor, setIssuedFor] = useState<{ institution: string; email: string } | null>(null);

  useEffect(() => {
    status().then((r) => setPublicKey(r.publicKey ?? "")).catch(() => {});
  }, [status]);

  async function onIssue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setKey("");
    setIssuedFor(null);
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
      setIssuedFor({ institution, email });
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

      {publicKey && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-2">
          <div className="font-display text-sm font-semibold">Vendor public key</div>
          <p className="text-xs text-muted-foreground">
            This is auto-generated and stored on this deployment. Schools set it as{" "}
            <code className="text-xs">LICENSE_PUBLIC_KEY</code> to verify keys you issue —
            or leave blank and they'll pull it via the license itself.
          </p>
          <Textarea readOnly value={publicKey} rows={2} className="font-mono text-xs" />
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

        <Button type="submit" disabled={busy}>
          {busy ? "Signing…" : "Generate license key"}
        </Button>
      </form>

      {key && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-primary" />
              <div>
              <div className="font-display text-sm font-semibold">License generated successfully</div>
              <p className="text-xs text-muted-foreground">
                {issuedFor
                  ? `This license is for ${issuedFor.institution} (${issuedFor.email}).`
                  : "Send this to the school. They paste it on their /setup page."}
              </p>
              </div>
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
          <div className="rounded-lg border border-primary/20 bg-background p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-primary">This is the license key</div>
            <Textarea readOnly value={key} rows={5} className="font-mono text-xs" />
          </div>
        </div>
      )}
    </div>
  );
}
