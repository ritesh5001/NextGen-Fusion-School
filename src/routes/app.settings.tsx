import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getInstituteSettings,
  saveInstituteSettings,
} from "@/lib/settings.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

type Data = {
  settings: {
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    motto: string | null;
    timezone: string;
    currency: string;
    currencySymbol: string;
  } | null;
  tenant: {
    name: string;
    primaryColor: string | null;
  } | null;
};

function SettingsPage() {
  const get = useServerFn(getInstituteSettings);
  const save = useServerFn(saveInstituteSettings);
  const [data, setData] = useState<Data | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setData((await get()) as Data);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
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

  return (
    <div className="p-8">
      <PageHeader
        title="Institute Settings"
        description="Set your school's brand, contact information, and platform-wide defaults."
      />

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setSaving(true);
          try {
            await save({
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
            toast.success("Settings saved");
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setSaving(false);
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
              <Input id="motto" name="motto" defaultValue={data.settings?.motto ?? ""} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                rows={2}
                defaultValue={data.settings?.address ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={data.settings?.phone ?? ""} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={data.settings?.email ?? ""}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://"
                defaultValue={data.settings?.website ?? ""}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Localization</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={data.settings?.timezone ?? "Asia/Kolkata"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  name="currency"
                  defaultValue={data.settings?.currency ?? "INR"}
                />
              </div>
              <div>
                <Label htmlFor="currencySymbol">Symbol</Label>
                <Input
                  id="currencySymbol"
                  name="currencySymbol"
                  defaultValue={data.settings?.currencySymbol ?? "₹"}
                />
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
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
