import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listUsers,
  saveUser,
  setUserActive,
  adminResetPassword,
  deleteUser,
} from "@/lib/users.functions";
import { listRoles } from "@/lib/roles.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, KeyRound, Trash2, Search, Power } from "lucide-react";

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
  head: () => ({
    meta: [{ title: "Users — NextGen Fusion School" }],
  }),
});

type Row = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | string | null;
  roles: { id: string; name: string; key: string }[];
};
type Role = { id: string; name: string; key: string };

function UsersPage() {
  const list = useServerFn(listUsers);
  const save = useServerFn(saveUser);
  const setActive = useServerFn(setUserActive);
  const resetPw = useServerFn(adminResetPassword);
  const del = useServerFn(deleteUser);
  const listR = useServerFn(listRoles);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [dlg, setDlg] = useState<{ open: boolean; edit: Row | null }>({
    open: false,
    edit: null,
  });
  const [pwDlg, setPwDlg] = useState<{ id: string; email: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = (await list({
        data: { query: query.trim() || undefined, active: "all", page: 1, pageSize: 100 },
      })) as { rows: Row[]; total: number };
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [list, query]);

  useEffect(() => {
    (async () => {
      try {
        const rs = (await listR()) as Role[];
        setRoles(rs);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [listR]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <PageHeader
        title="Users & Access"
        description="System users, role assignments, and password management."
        action={
          <Button onClick={() => setDlg({ open: true, edit: null })}>
            <Plus className="mr-1 size-4" />
            Add user
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search email or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground">{total} user{total === 1 ? "" : "s"}</div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No roles</span>
                    ) : (
                      r.roles.map((role) => (
                        <Badge key={role.id} variant="secondary" className="text-[10px]">
                          {role.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {r.isActive ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setDlg({ open: true, edit: r })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPwDlg({ id: r.id, email: r.email })}
                    title="Reset password"
                  >
                    <KeyRound className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await setActive({ data: { id: r.id, isActive: !r.isActive } });
                      toast.success(r.isActive ? "Deactivated" : "Activated");
                      refresh();
                    }}
                    title={r.isActive ? "Deactivate" : "Activate"}
                  >
                    <Power className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Delete ${r.email}?`)) return;
                      try {
                        await del({ data: { id: r.id } });
                        toast.success("Deleted");
                        refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <UserDialog
        open={dlg.open}
        edit={dlg.edit}
        roles={roles}
        onClose={() => setDlg({ open: false, edit: null })}
        onSubmit={async (payload) => {
          try {
            await save({ data: payload });
            toast.success("Saved");
            setDlg({ open: false, edit: null });
            refresh();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <ResetPasswordDialog
        target={pwDlg}
        onClose={() => setPwDlg(null)}
        onSubmit={async (newPassword) => {
          if (!pwDlg) return;
          try {
            await resetPw({ data: { id: pwDlg.id, newPassword } });
            toast.success("Password reset; sessions revoked");
            setPwDlg(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function UserDialog({
  open,
  edit,
  roles,
  onClose,
  onSubmit,
}: {
  open: boolean;
  edit: Row | null;
  roles: Role[];
  onClose: () => void;
  onSubmit: (payload: {
    id?: string;
    email: string;
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    password?: string;
    roleIds: string[];
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [roleIds, setRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setEmail(edit?.email ?? "");
      setFirstName(edit?.firstName ?? "");
      setLastName(edit?.lastName ?? "");
      setPhone(edit?.phone ?? "");
      setPassword("");
      setIsActive(edit?.isActive ?? true);
      setRoleIds(edit?.roles.map((r) => r.id) ?? []);
    }
  }, [open, edit]);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>{edit ? "New password (leave blank to keep)" : "Password"}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={edit ? "••••••••" : "Min 8 characters"}
            />
          </div>
          <div>
            <Label>Roles</Label>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border p-2">
              {roles.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No roles defined. Create roles in Roles & Permissions first.
                </div>
              ) : (
                roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={roleIds.includes(r.id)}
                      onChange={(e) => {
                        setRoleIds((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id),
                        );
                      }}
                    />
                    <span>{r.name}</span>
                    <span className="text-xs text-muted-foreground">{r.key}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                id: edit?.id,
                email,
                firstName,
                lastName: lastName || null,
                phone: phone || null,
                password: password || undefined,
                roleIds,
                isActive,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: { id: string; email: string } | null;
  onClose: () => void;
  onSubmit: (pw: string) => Promise<void>;
}) {
  const [pw, setPw] = useState("");
  useEffect(() => {
    if (target) setPw("");
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Set a new password for <strong>{target?.email}</strong>. All active sessions will be
          revoked.
        </p>
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New password (min 8 chars)"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pw.length < 8} onClick={() => onSubmit(pw)}>
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
