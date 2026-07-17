import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listTeachers,
  saveTeacher,
  deleteTeacher,
} from "@/lib/teachers.functions";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/app/teachers")({
  component: TeachersPage,
});

type Teacher = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  qualification: string | null;
  designation: string | null;
  isActive: boolean;
};

function TeachersPage() {
  const list = useServerFn(listTeachers);
  const save = useServerFn(saveTeacher);
  const del = useServerFn(deleteTeacher);

  const [rows, setRows] = useState<Teacher[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [dlg, setDlg] = useState<{ open: boolean; edit: Teacher | null }>({
    open: false,
    edit: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = (await list({
        data: { query: query.trim() || undefined, page, pageSize: 25 },
      })) as { rows: Teacher[]; total: number };
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [list, query, page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="p-8">
      <PageHeader
        title="Teachers"
        description="Faculty directory, contact and appointment details."
        action={
          <Button onClick={() => setDlg({ open: true, edit: null })}>
            <Plus className="mr-2 size-4" /> Add teacher
          </Button>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, code, email…"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
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
                  No teachers yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.employeeCode}</TableCell>
                  <TableCell className="font-medium">
                    {t.firstName} {t.lastName ?? ""}
                    {t.qualification ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.qualification}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{t.designation ?? "—"}</TableCell>
                  <TableCell>
                    <div className="text-sm">{t.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.phone ?? ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "default" : "secondary"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDlg({ open: true, edit: t })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete ${t.firstName}?`)) return;
                        try {
                          await del({ data: { id: t.id } });
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
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <div className="text-muted-foreground">
            {total} teacher{total === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o, edit: dlg.edit })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dlg.edit ? "Edit teacher" : "New teacher"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await save({
                  data: {
                    id: dlg.edit?.id,
                    employeeCode: String(fd.get("employeeCode") ?? ""),
                    firstName: String(fd.get("firstName") ?? ""),
                    lastName: String(fd.get("lastName") ?? "") || null,
                    gender: (fd.get("gender") as "male" | "female" | "other") || null,
                    dob: String(fd.get("dob") ?? "") || null,
                    phone: String(fd.get("phone") ?? "") || null,
                    email: String(fd.get("email") ?? "") || null,
                    qualification: String(fd.get("qualification") ?? "") || null,
                    designation: String(fd.get("designation") ?? "") || null,
                    joinedOn: String(fd.get("joinedOn") ?? "") || null,
                    address: String(fd.get("address") ?? "") || null,
                    bio: String(fd.get("bio") ?? "") || null,
                    isActive: fd.get("isActive") === "on",
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="employeeCode">Employee code</Label>
                <Input
                  id="employeeCode"
                  name="employeeCode"
                  defaultValue={dlg.edit?.employeeCode ?? ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={dlg.edit?.firstName ?? ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" defaultValue={dlg.edit?.lastName ?? ""} />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={dlg.edit?.gender ?? ""}
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" name="dob" type="date" />
              </div>
              <div>
                <Label htmlFor="joinedOn">Joined on</Label>
                <Input id="joinedOn" name="joinedOn" type="date" />
              </div>
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  name="designation"
                  defaultValue={dlg.edit?.designation ?? ""}
                  placeholder="e.g. Senior Teacher"
                />
              </div>
              <div>
                <Label htmlFor="qualification">Qualification</Label>
                <Input
                  id="qualification"
                  name="qualification"
                  defaultValue={dlg.edit?.qualification ?? ""}
                  placeholder="e.g. M.Sc, B.Ed"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={dlg.edit?.phone ?? ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={dlg.edit?.email ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Input id="bio" name="bio" placeholder="Short public bio" />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={dlg.edit?.isActive ?? true}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <DialogFooter>
              <Button type="submit">Save teacher</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
