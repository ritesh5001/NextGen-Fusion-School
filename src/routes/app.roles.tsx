import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listPermissions,
  listRoles,
  getRolePermissions,
  setRolePermissions,
  saveRole,
  deleteRole,
} from "@/lib/roles.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/roles")({
  component: RolesPage,
});

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
};
type Permission = {
  id: string;
  key: string;
  module: string;
  description: string | null;
};

function RolesPage() {
  const list = useServerFn(listRoles);
  const listP = useServerFn(listPermissions);
  const save = useServerFn(saveRole);
  const del = useServerFn(deleteRole);
  const getP = useServerFn(getRolePermissions);
  const setP = useServerFn(setRolePermissions);

  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [dlg, setDlg] = useState<{ open: boolean; edit: Role | null }>({
    open: false,
    edit: null,
  });
  const [grid, setGrid] = useState<{ open: boolean; role: Role | null }>({
    open: false,
    role: null,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const [rs, ps] = await Promise.all([list(), listP()]);
      setRoles(rs as Role[]);
      setPermissions(ps as Permission[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byModule = useMemo(() => {
    const m = new Map<string, Permission[]>();
    for (const p of permissions) {
      const arr = m.get(p.module) ?? [];
      arr.push(p);
      m.set(p.module, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  async function openGrid(role: Role) {
    try {
      const ids = (await getP({ data: { roleId: role.id } })) as string[];
      setSelected(new Set(ids));
      setGrid({ open: true, role });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleModule(mod: string, perms: Permission[]) {
    const allOn = perms.every((p) => selected.has(p.id));
    const next = new Set(selected);
    for (const p of perms) {
      if (allOn) next.delete(p.id);
      else next.add(p.id);
    }
    setSelected(next);
  }

  async function saveGrid() {
    if (!grid.role) return;
    setSaving(true);
    try {
      await setP({
        data: { roleId: grid.role.id, permissionIds: Array.from(selected) },
      });
      toast.success("Permissions updated");
      setGrid({ open: false, role: null });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Roles & Permissions"
        description="Define who can access what. Change permissions per role or add custom roles for your school."
        action={
          <Button onClick={() => setDlg({ open: true, edit: null })}>
            <Plus className="mr-2 size-4" /> New role
          </Button>
        }
      />

      {roles === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <span className="font-semibold">{r.name}</span>
                    {r.isSystem && <Badge variant="secondary">System</Badge>}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {r.key}
                  </div>
                  {r.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{r.permissionCount} permissions</span>
                <span>·</span>
                <span>{r.userCount} users</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openGrid(r)}>
                  Permissions
                </Button>
                {!r.isSystem && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDlg({ open: true, edit: r })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Delete role "${r.name}"?`)) return;
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
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Role editor */}
      <Dialog
        open={dlg.open}
        onOpenChange={(o) => setDlg({ open: o, edit: dlg.edit })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.edit ? "Edit role" : "New role"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await save({
                  data: {
                    id: dlg.edit?.id,
                    key: String(fd.get("key") ?? ""),
                    name: String(fd.get("name") ?? ""),
                    description: String(fd.get("description") ?? "") || null,
                  },
                });
                toast.success("Saved");
                setDlg({ open: false, edit: null });
                refresh();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={dlg.edit?.name ?? ""} required />
            </div>
            <div>
              <Label htmlFor="key">Key (lowercase)</Label>
              <Input
                id="key"
                name="key"
                placeholder="counsellor"
                defaultValue={dlg.edit?.key ?? ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                defaultValue={dlg.edit?.description ?? ""}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permission grid */}
      <Dialog
        open={grid.open}
        onOpenChange={(o) => setGrid({ open: o, role: grid.role })}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Permissions for {grid.role?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {byModule.map(([mod, perms]) => {
              const allOn = perms.every((p) => selected.has(p.id));
              const someOn = perms.some((p) => selected.has(p.id));
              return (
                <div key={mod} className="rounded-md border">
                  <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2">
                    <Checkbox
                      id={`mod-${mod}`}
                      checked={allOn}
                      className={someOn && !allOn ? "data-[state=unchecked]:bg-primary/30" : ""}
                      onCheckedChange={() => toggleModule(mod, perms)}
                    />
                    <label
                      htmlFor={`mod-${mod}`}
                      className="cursor-pointer text-sm font-semibold uppercase tracking-wide"
                    >
                      {mod}
                    </label>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {perms.filter((p) => selected.has(p.id)).length}/{perms.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                    {perms.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-start gap-2 rounded-md p-1.5 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggle(p.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-mono text-xs">{p.key}</div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground">
                              {p.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={saveGrid} disabled={saving}>
              {saving ? "Saving…" : "Save permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
