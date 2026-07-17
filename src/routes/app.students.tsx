import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listStudents,
  saveStudent,
  deleteStudent,
} from "@/lib/students.functions";
import {
  listClasses,
  listSections,
} from "@/lib/academic.functions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/app/students")({
  component: StudentsPage,
});

type ClassOpt = { id: string; name: string };
type SectionOpt = { id: string; classId: string; name: string };
type Student = {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  classId: string | null;
  sectionId: string | null;
  className: string | null;
  sectionName: string | null;
  isActive: boolean;
};

const ALL = "__all__";

function StudentsPage() {
  const list = useServerFn(listStudents);
  const save = useServerFn(saveStudent);
  const del = useServerFn(deleteStudent);
  const listC = useServerFn(listClasses);
  const listS = useServerFn(listSections);

  const [rows, setRows] = useState<Student[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [sectionFilter, setSectionFilter] = useState<string>(ALL);

  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);

  const [dlg, setDlg] = useState<{ open: boolean; edit: Student | null }>({
    open: false,
    edit: null,
  });
  // sections available in the form (filtered by chosen classId)
  const [formSections, setFormSections] = useState<SectionOpt[]>([]);
  const [formClassId, setFormClassId] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const res = (await list({
        data: {
          query: query.trim() || undefined,
          classId: classFilter === ALL ? undefined : classFilter,
          sectionId: sectionFilter === ALL ? undefined : sectionFilter,
          page,
          pageSize: 25,
        },
      })) as { rows: Student[]; total: number };
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [list, query, classFilter, sectionFilter, page]);

  useEffect(() => {
    (async () => {
      try {
        const [cs, ss] = await Promise.all([listC(), listS({ data: {} })]);
        setClasses((cs as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })));
        setSections(ss as SectionOpt[]);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openNew() {
    setFormClassId("");
    setFormSections([]);
    setDlg({ open: true, edit: null });
  }
  function openEdit(s: Student) {
    setFormClassId(s.classId ?? "");
    setFormSections(sections.filter((x) => x.classId === s.classId));
    setDlg({ open: true, edit: s });
  }

  function onFormClassChange(cid: string) {
    setFormClassId(cid);
    setFormSections(sections.filter((s) => s.classId === cid));
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  const filteredFilterSections =
    classFilter === ALL ? sections : sections.filter((s) => s.classId === classFilter);

  return (
    <div className="p-8">
      <PageHeader
        title="Students"
        description="Full student roster with search and filtering."
        action={
          <Button onClick={openNew}>
            <Plus className="mr-2 size-4" /> Add student
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, admission no, phone…"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={classFilter}
          onValueChange={(v) => {
            setClassFilter(v);
            setSectionFilter(ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sectionFilter}
          onValueChange={(v) => {
            setSectionFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sections</SelectItem>
            {filteredFilterSections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class / Section</TableHead>
              <TableHead>Guardian</TableHead>
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
                  No students found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.admissionNo}</TableCell>
                  <TableCell className="font-medium">
                    {s.firstName} {s.lastName ?? ""}
                    {s.rollNo ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Roll #{s.rollNo}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {s.className ? (
                      <>
                        {s.className}
                        {s.sectionName ? ` – ${s.sectionName}` : ""}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.guardianName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.guardianPhone ?? ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete ${s.firstName}?`)) return;
                        try {
                          await del({ data: { id: s.id } });
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
            {total} student{total === 1 ? "" : "s"}
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
            <DialogTitle>{dlg.edit ? "Edit student" : "New student"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await save({
                  data: {
                    id: dlg.edit?.id,
                    admissionNo: String(fd.get("admissionNo") ?? ""),
                    rollNo: String(fd.get("rollNo") ?? "") || null,
                    firstName: String(fd.get("firstName") ?? ""),
                    lastName: String(fd.get("lastName") ?? "") || null,
                    gender: (fd.get("gender") as "male" | "female" | "other") || null,
                    dob: String(fd.get("dob") ?? "") || null,
                    phone: String(fd.get("phone") ?? "") || null,
                    email: String(fd.get("email") ?? "") || null,
                    address: String(fd.get("address") ?? "") || null,
                    guardianName: String(fd.get("guardianName") ?? "") || null,
                    guardianPhone: String(fd.get("guardianPhone") ?? "") || null,
                    guardianEmail: String(fd.get("guardianEmail") ?? "") || null,
                    classId: formClassId || null,
                    sectionId: String(fd.get("sectionId") ?? "") || null,
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
                <Label htmlFor="admissionNo">Admission #</Label>
                <Input
                  id="admissionNo"
                  name="admissionNo"
                  defaultValue={dlg.edit?.admissionNo ?? ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rollNo">Roll #</Label>
                <Input id="rollNo" name="rollNo" defaultValue={dlg.edit?.rollNo ?? ""} />
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
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" name="dob" type="date" />
              </div>
              <div>
                <Label htmlFor="s-classId">Class</Label>
                <Select value={formClassId} onValueChange={onFormClassChange}>
                  <SelectTrigger id="s-classId">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="s-sectionId">Section</Label>
                <select
                  id="s-sectionId"
                  name="sectionId"
                  defaultValue={dlg.edit?.sectionId ?? ""}
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {formSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="guardianName">Guardian name</Label>
                <Input
                  id="guardianName"
                  name="guardianName"
                  defaultValue={dlg.edit?.guardianName ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="guardianPhone">Guardian phone</Label>
                <Input
                  id="guardianPhone"
                  name="guardianPhone"
                  defaultValue={dlg.edit?.guardianPhone ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="guardianEmail">Guardian email</Label>
                <Input id="guardianEmail" name="guardianEmail" type="email" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Student email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" />
            </div>
            <DialogFooter>
              <Button type="submit">Save student</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
