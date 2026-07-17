import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
} from "@/lib/tenants.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/app/tenants")({
  component: TenantsPage,
});

type Row = {
  id: string;
  slug: string;
  name: string;
  plan: "starter" | "growth" | "premium";
  subscriptionStatus: string;
  createdAt: string | Date;
  userCount: number;
};

function TenantsPage() {
  const list = useServerFn(listTenants);
  const create = useServerFn(createTenant);
  const upd = useServerFn(updateTenant);
  const del = useServerFn(deleteTenant);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSuper = getSession()?.user.isSuperAdmin ?? false;

  async function refresh() {
    try {
      const data = (await list()) as Row[];
      setRows(data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSuper) {
    return (
      <div className="p-8">
        <PageHeader title="Schools (Tenants)" />
        <p className="text-sm text-muted-foreground">
          Only platform super admins can manage tenants.
        </p>
      </div>
    );
  }

  async function onCreate(form: FormData) {
    setLoading(true);
    try {
      await create({
        data: {
          slug: String(form.get("slug") ?? ""),
          name: String(form.get("name") ?? ""),
          plan: (form.get("plan") as "starter" | "growth" | "premium") ?? "starter",
          adminEmail: String(form.get("adminEmail") ?? ""),
          adminPassword: String(form.get("adminPassword") ?? ""),
          adminFirstName: String(form.get("adminFirstName") ?? ""),
          adminLastName: String(form.get("adminLastName") ?? ""),
        },
      });
      toast.success("School created");
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Schools (Tenants)"
        description="Every school on the platform. Onboard, upgrade plans, and manage subscriptions."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" /> Onboard school
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Onboard a new school</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onCreate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="name">School name</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="slug">Slug</Label>
                    <Input id="slug" name="slug" placeholder="dps-delhi" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="plan">Plan</Label>
                  <select
                    id="plan"
                    name="plan"
                    defaultValue="starter"
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="starter">Starter — ₹500/mo</option>
                    <option value="growth">Growth — ₹1000/mo</option>
                    <option value="premium">Premium — ₹1500/mo</option>
                  </select>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Primary administrator
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="adminFirstName">First name</Label>
                      <Input id="adminFirstName" name="adminFirstName" required />
                    </div>
                    <div>
                      <Label htmlFor="adminLastName">Last name</Label>
                      <Input id="adminLastName" name="adminLastName" />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="adminEmail">Email</Label>
                      <Input
                        id="adminEmail"
                        name="adminEmail"
                        type="email"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="adminPassword">Temporary password</Label>
                      <Input
                        id="adminPassword"
                        name="adminPassword"
                        type="password"
                        minLength={8}
                        required
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating…" : "Create school"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="w-[1%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No schools yet. Onboard one to get started.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                  <TableCell>
                    <Select
                      defaultValue={r.plan}
                      onValueChange={async (v) => {
                        try {
                          await upd({ data: { id: r.id, plan: v as Row["plan"] } });
                          toast.success("Plan updated");
                          refresh();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="growth">Growth</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.subscriptionStatus === "active" ? "default" : "secondary"}>
                      {r.subscriptionStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.userCount}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete ${r.name}? This removes all data.`)) return;
                        try {
                          await del({ data: { id: r.id } });
                          toast.success("Deleted");
                          refresh();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
