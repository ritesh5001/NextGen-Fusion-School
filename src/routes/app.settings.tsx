import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getInstituteSettings,
  saveInstituteSettings,
  saveSmtpSettings,
  saveReportSettings,
} from "@/lib/settings.functions";
import { getMailStatus, sendTestEmail } from "@/lib/mail.functions";
import { getLicenseStatus, setLicenseKey } from "@/lib/license.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImagePicker } from "@/components/image-picker";



export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

type Settings = {
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  motto: string | null;
  timezone: string;
  currency: string;
  currencySymbol: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  smtpSecure: boolean;
  reportHeader: string | null;
  reportFooter: string | null;
  reportLogoUrl: string | null;
  reportSignatureUrl: string | null;
  reportPrincipalName: string | null;
};

type Data = {
  settings: Settings | null;
  tenant: { name: string; primaryColor: string | null } | null;
};

function SettingsPage() {
  const get = useServerFn(getInstituteSettings);
  const saveGen = useServerFn(saveInstituteSettings);
  const saveSmtp = useServerFn(saveSmtpSettings);
  const saveRep = useServerFn(saveReportSettings);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setData((await get()) as Data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <div className="p-8">
        <PageHeader title="Institute Settings" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const s = data.settings;

  return (
    <div className="p-8">
      <PageHeader
        title="Institute Settings"
        description="Brand, contact, email delivery, and marksheet/report configuration."
      />

      <Tabs defaultValue="general" className="mt-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="license">License</TabsTrigger>
        </TabsList>

        <TabsContent value="license" className="mt-6">
          <LicensePanel />
        </TabsContent>

        {/* ------------- GENERAL ------------- */}
        <TabsContent value="general" className="mt-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await saveGen({
                  data: {
                    name: String(fd.get("name") ?? ""),
                    motto: String(fd.get("motto") ?? "") || null,
                    address: String(fd.get("address") ?? "") || null,
                    phone: String(fd.get("phone") ?? "") || null,
                    email: String(fd.get("email") ?? "") || null,
                    website: String(fd.get("website") ?? "") || null,
                    timezone: String(fd.get("timezone") ?? "Asia/Kolkata"),
                    currency: String(fd.get("currency") ?? "INR"),
                    currencySymbol: String(fd.get("currencySymbol") ?? "₹"),
                    primaryColor: String(fd.get("primaryColor") ?? "") || null,
                  },
                });
                toast.success("Saved");
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            <Card className="p-6 lg:col-span-2">
              <h2 className="mb-4 font-display text-lg font-semibold">Identity</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">School name</Label>
                  <Input id="name" name="name" defaultValue={data.tenant?.name ?? ""} required />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="motto">Motto</Label>
                  <Input id="motto" name="motto" defaultValue={s?.motto ?? ""} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" name="address" rows={2} defaultValue={s?.address ?? ""} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={s?.phone ?? ""} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={s?.email ?? ""} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" name="website" type="url" placeholder="https://" defaultValue={s?.website ?? ""} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Localization</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" name="timezone" defaultValue={s?.timezone ?? "Asia/Kolkata"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Input id="currency" name="currency" defaultValue={s?.currency ?? "INR"} />
                  </div>
                  <div>
                    <Label htmlFor="currencySymbol">Symbol</Label>
                    <Input id="currencySymbol" name="currencySymbol" defaultValue={s?.currencySymbol ?? "₹"} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="primaryColor">Brand color</Label>
                  <Input
                    id="primaryColor"
                    name="primaryColor"
                    type="color"
                    defaultValue={data.tenant?.primaryColor ?? "#059669"}
                    className="h-10 w-full"
                  />
                </div>
              </div>
            </Card>

            <div className="lg:col-span-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ------------- EMAIL / SMTP ------------- */}
        <TabsContent value="email" className="mt-6">
          <SmtpForm
            initial={s}
            onSubmit={async (payload) => {
              setBusy(true);
              try {
                await saveSmtp({ data: payload });
                toast.success("SMTP saved");
                await reload();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            busy={busy}
          />
        </TabsContent>

        {/* ------------- REPORTS ------------- */}
        <TabsContent value="reports" className="mt-6">
          <ReportForm
            initial={s}
            onSubmit={async (payload) => {
              setBusy(true);
              try {
                await saveRep({ data: payload });
                toast.success("Report settings saved");
                await reload();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            busy={busy}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SmtpForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: Settings | null;
  onSubmit: (p: {
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUsername: string | null;
    smtpPassword: string | null;
    smtpFromEmail: string | null;
    smtpFromName: string | null;
    smtpSecure: boolean;
  }) => Promise<void>;
  busy: boolean;
}) {
  const mailStatus = useServerFn(getMailStatus);
  const sendTest = useServerFn(sendTestEmail);
  const [status, setStatus] = useState<{ configured: boolean } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    mailStatus().then(setStatus).catch(() => setStatus({ configured: false }));
  }, [mailStatus]);

  const fromDomain = (initial?.smtpFromEmail ?? "").split("@")[1] ?? "";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit({
          // Resend needs only from-email + from-name; legacy SMTP columns
          // are preserved but left unused.
          smtpHost: null,
          smtpPort: null,
          smtpUsername: null,
          smtpPassword: null,
          smtpFromEmail: String(fd.get("smtpFromEmail") ?? "") || null,
          smtpFromName: String(fd.get("smtpFromName") ?? "") || null,
          smtpSecure: true,
        });
      }}
    >
      <Card className="p-6 max-w-3xl space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Email delivery</h2>
          <p className="text-sm text-muted-foreground">
            Emails are sent through <strong>Resend</strong>. The only server-side
            secret required is <code className="text-xs">RESEND_API_KEY</code>.
            The sender name and address below appear in every outgoing message —
            password resets, admission confirmations, notices, and receipts.
          </p>
        </div>

        <div
          className={`rounded-lg border p-3 text-sm ${
            status?.configured
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          }`}
        >
          {status?.configured
            ? "✓ RESEND_API_KEY detected — email delivery is active."
            : "⚠ RESEND_API_KEY is not set on this deployment. Add it to your environment to enable sending."}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="smtpFromName">From name</Label>
            <Input
              id="smtpFromName"
              name="smtpFromName"
              placeholder="e.g. Greenfield Public School"
              defaultValue={initial?.smtpFromName ?? ""}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Defaults to your school name.
            </p>
          </div>
          <div>
            <Label htmlFor="smtpFromEmail">From email</Label>
            <Input
              id="smtpFromEmail"
              name="smtpFromEmail"
              type="email"
              placeholder="no-reply@yourschool.com"
              defaultValue={initial?.smtpFromEmail ?? ""}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {fromDomain
                ? `Verify the domain "${fromDomain}" in your Resend dashboard.`
                : "Leave blank to use onboarding@resend.dev for testing."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save email settings"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-2 text-sm font-medium">Send a test email</div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              disabled={testing || !testTo || !status?.configured}
              onClick={async () => {
                setTesting(true);
                try {
                  await sendTest({ data: { to: testTo } });
                  toast.success("Test email sent");
                } catch (err) {
                  const msg =
                    err instanceof Response
                      ? await err.text()
                      : (err as Error).message;
                  toast.error(msg || "Failed to send");
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? "Sending…" : "Send test"}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}

function ReportForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: Settings | null;
  onSubmit: (p: {
    reportHeader: string | null;
    reportFooter: string | null;
    reportLogoUrl: string | null;
    reportSignatureUrl: string | null;
    reportPrincipalName: string | null;
  }) => Promise<void>;
  busy: boolean;
}) {
  const [logoUrl, setLogoUrl] = useState<string>(initial?.reportLogoUrl ?? "");
  const [signatureUrl, setSignatureUrl] = useState<string>(
    initial?.reportSignatureUrl ?? "",
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit({
          reportHeader: String(fd.get("reportHeader") ?? "") || null,
          reportFooter: String(fd.get("reportFooter") ?? "") || null,
          reportLogoUrl: logoUrl || null,
          reportSignatureUrl: signatureUrl || null,
          reportPrincipalName:
            String(fd.get("reportPrincipalName") ?? "") || null,
        });
      }}
    >
      <Card className="p-6 max-w-3xl">
        <h2 className="mb-4 font-display text-lg font-semibold">
          Report & marksheet branding
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Appears on printed marksheets, fee receipts, and payslips.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="reportHeader">Header line</Label>
            <Input
              id="reportHeader"
              name="reportHeader"
              placeholder="e.g. Affiliated to CBSE · Recognized by Govt."
              defaultValue={initial?.reportHeader ?? ""}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="reportFooter">Footer text</Label>
            <Textarea
              id="reportFooter"
              name="reportFooter"
              rows={2}
              defaultValue={initial?.reportFooter ?? ""}
            />
          </div>
          <div>
            <Label>Logo</Label>
            <ImagePicker
              value={logoUrl}
              onChange={setLogoUrl}
              folder="reports"
              aspect="square"
            />
          </div>
          <div>
            <Label>Principal signature</Label>
            <ImagePicker
              value={signatureUrl}
              onChange={setSignatureUrl}
              folder="reports"
              aspect="wide"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="reportPrincipalName">Principal name</Label>
            <Input
              id="reportPrincipalName"
              name="reportPrincipalName"
              defaultValue={initial?.reportPrincipalName ?? ""}
            />
          </div>
        </div>
        <div className="mt-6">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save report settings"}
          </Button>
        </div>
      </Card>
    </form>
  );
}

function LicensePanel() {
  const getStatus = useServerFn(getLicenseStatus);
  const activate = useServerFn(setLicenseKey);
  const [state, setState] = useState<Awaited<ReturnType<typeof getStatus>> | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setState(await getStatus());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activateNow(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await activate({ data: { licenseKey: key.trim() } });
      toast.success("License activated");
      setKey("");
      await reload();
    } catch (err) {
      const msg = err instanceof Response ? await err.text() : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const st = state?.status;
  const p = st?.payload;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-2">
        <h2 className="mb-1 font-display text-lg font-semibold">Deployment license</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Paste the license key issued for this school. The key is verified offline against the
          vendor's public key configured in the server environment.
        </p>
        <form onSubmit={activateNow} className="space-y-3">
          <Label htmlFor="lk">License key</Label>
          <Textarea
            id="lk"
            rows={4}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="eyJpbnN0aXR1dGlvbiI6...."
            className="font-mono text-xs"
          />
          <Button type="submit" disabled={busy || !key.trim()}>
            {busy ? "Verifying…" : "Activate license"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Current status</h2>
        {!state ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !state.hasKey ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            No license key installed. The app runs with an unlicensed banner until a valid key is
            activated.
          </p>
        ) : st?.valid ? (
          <dl className="space-y-2 text-sm">
            <Row label="Institution" value={p?.institution} />
            <Row label="Plan" value={p?.planLabel} />
            <Row label="Issued" value={p?.issuedAt} />
            <Row label="Expires" value="Never (perpetual license)" />
            <Row label="Max students" value={p?.maxStudents ? String(p.maxStudents) : "Unlimited"} />
            <Row label="Features" value={(p?.features ?? []).join(", ") || "*"} />
            {st.expiresInDays != null && (
              <Row
                label="Days remaining"
                value={st.expiresInDays.toString()}
              />
            )}
          </dl>
        ) : (
          <p className="text-sm text-destructive">
            License invalid: {st?.reason ?? "unknown reason"}.
          </p>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-1 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}
