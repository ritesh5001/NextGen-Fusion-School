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
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

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
          <TabsTrigger value="email">Email / SMTP</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

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
  const [secure, setSecure] = useState(initial?.smtpSecure ?? true);
  const [password, setPassword] = useState(initial?.smtpPassword ?? "");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit({
          smtpHost: String(fd.get("smtpHost") ?? "") || null,
          smtpPort: fd.get("smtpPort") ? Number(fd.get("smtpPort")) : null,
          smtpUsername: String(fd.get("smtpUsername") ?? "") || null,
          smtpPassword: password || null,
          smtpFromEmail: String(fd.get("smtpFromEmail") ?? "") || null,
          smtpFromName: String(fd.get("smtpFromName") ?? "") || null,
          smtpSecure: secure,
        });
      }}
    >
      <Card className="p-6 max-w-3xl">
        <h2 className="mb-4 font-display text-lg font-semibold">SMTP configuration</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Used for password resets, notice emails, and admission confirmations.
          Leave password blank to keep the existing one.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="smtpHost">SMTP host</Label>
            <Input
              id="smtpHost"
              name="smtpHost"
              placeholder="smtp.gmail.com"
              defaultValue={initial?.smtpHost ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="smtpPort">Port</Label>
            <Input
              id="smtpPort"
              name="smtpPort"
              type="number"
              placeholder="587"
              defaultValue={initial?.smtpPort ?? ""}
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch
              id="smtpSecure"
              checked={secure}
              onCheckedChange={setSecure}
            />
            <Label htmlFor="smtpSecure">Use TLS/SSL</Label>
          </div>
          <div>
            <Label htmlFor="smtpUsername">Username</Label>
            <Input
              id="smtpUsername"
              name="smtpUsername"
              defaultValue={initial?.smtpUsername ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="smtpPassword">Password</Label>
            <Input
              id="smtpPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={initial?.smtpPassword ? "•••••••• (unchanged)" : ""}
            />
          </div>
          <div>
            <Label htmlFor="smtpFromEmail">From email</Label>
            <Input
              id="smtpFromEmail"
              name="smtpFromEmail"
              type="email"
              defaultValue={initial?.smtpFromEmail ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="smtpFromName">From name</Label>
            <Input
              id="smtpFromName"
              name="smtpFromName"
              defaultValue={initial?.smtpFromName ?? ""}
            />
          </div>
        </div>

        <div className="mt-6">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save SMTP"}
          </Button>
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
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit({
          reportHeader: String(fd.get("reportHeader") ?? "") || null,
          reportFooter: String(fd.get("reportFooter") ?? "") || null,
          reportLogoUrl: String(fd.get("reportLogoUrl") ?? "") || null,
          reportSignatureUrl: String(fd.get("reportSignatureUrl") ?? "") || null,
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
            <Label htmlFor="reportLogoUrl">Logo URL</Label>
            <Input
              id="reportLogoUrl"
              name="reportLogoUrl"
              type="url"
              defaultValue={initial?.reportLogoUrl ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="reportSignatureUrl">Principal signature URL</Label>
            <Input
              id="reportSignatureUrl"
              name="reportSignatureUrl"
              type="url"
              defaultValue={initial?.reportSignatureUrl ?? ""}
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
