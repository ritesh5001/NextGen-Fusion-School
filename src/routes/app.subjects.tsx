import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listSubjects,
  saveSubject,
  deleteSubject,
  listAssignments,
  saveAssignment,
  deleteAssignment,
} from "@/lib/subjects.functions";
import { listClasses, listSections } from "@/lib/academic.functions";
import { listTeachersLite } from "@/lib/teachers.functions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Link2 } from "lucide-react";

export const Route = createFileRoute("/app/subjects")({
  component: SubjectsPage,
});

type Subject = { id: string; name: string; code: string | null };
type ClassOpt = { id: string; name: string };
type SectionOpt = { id: string; classId: string; name: string };
type TeacherOpt = {
  id: string;
  firstName: string;
  lastName: string | null;
  employeeCode: string;
};
type Assignment = {
  id: string;
  classId: string;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  teacherFirstName: string | null;
  teacherLastName: string | null;
};

const NONE = "__none__";

function SubjectsPage() {
  const lS = useServerFn(listSubjects);
  const sS = useServerFn(saveSubject);
  const dS = useServerFn(deleteSubject);
  const lA = useServerFn(listAssignments);
  const sA = useServerFn(saveAssignment);
  const dA = useServerFn(deleteAssignment);
  const lC = useServerFn(listClasses);
  const lSec = useServerFn(listSections);
  const lT = useServerFn(listTeachersLite);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);

  const [dlg, setDlg] = useState<{ open: boolean; edit: Subject | null }>({
    open: false,
    edit: null,
  });
  const [assignDlg, setAssignDlg] = useState(false);
  const [assignClass, setAssignClass] = useState<string>("");
  const [assignSection, setAssignSection] = useState<string>(NONE);
  const [assignSubject, setAssignSubject] = useState<string>("");
  const [assignTeacher, setAssignTeacher] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const [subs, asns] = await Promise.all([lS(), lA({ data: {} })]);
      setSubjects(subs as Subject[]);
      setAssignments(asns as Assignment[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [lS, lA]);

  useEffect(() => {
    (async () => {
      try {
        const [cs, ss, ts] = await Promise.all([
          lC(),
          lSec({ data: {} }),
          lT(),
        ]);
        setClasses(
          (cs as { id: string; name: string }[]).map((c) => ({
            id: c.id,
            name: c.name,
          })),
        );
        setSections(ss as SectionOpt[]);
        setTeachers(ts as TeacherOpt[]);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    refresh();
  }, [lC, lSec, lT, refresh]);

  const availableSections = assignClass
    ? sections.filter((s) => s.classId === assignClass)
    : [];

  return (
    <div className="p-8">
      <PageHeader
        title="Subjects & Teaching Assignments"
        description="Define subjects and map them to classes and teachers."
        action={
          <Button onClick={() => setDlg({ open: true, edit: null })}>
            <Plus className="mr-2 size-4" /> Add subject
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subjects */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Subjects</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    No subjects yet.
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.code ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDlg({ open: true, edit: s })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm(`Delete ${s.name}?`)) return;
                          try {
                            await dS({ data: { id: s.id } });
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

        {/* Assignments */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Class → Subject → Teacher</h3>
            <Button size="sm" variant="outline" onClick={() => setAssignDlg(true)}>
              <Link2 className="mr-2 size-4" /> New mapping
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No mappings yet.
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {a.className}
                      {a.sectionName ? (
                        <span className="text-muted-foreground"> – {a.sectionName}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{a.subjectName}</TableCell>
                    <TableCell>
                      {a.teacherFirstName} {a.teacherLastName ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Remove mapping?")) return;
                          try {
                            await dA({ data: { id: a.id } });
                            toast.success("Removed");
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

      {/* Subject dialog */}
      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o, edit: dlg.edit })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.edit ? "Edit subject" : "New subject"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await sS({
                  data: {
                    id: dlg.edit?.id,
                    name: String(fd.get("name") ?? ""),
                    code: String(fd.get("code") ?? "") || null,
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
              <Label htmlFor="s-name">Name</Label>
              <Input
                id="s-name"
                name="name"
                defaultValue={dlg.edit?.name ?? ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="s-code">Code</Label>
              <Input id="s-code" name="code" defaultValue={dlg.edit?.code ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit">Save subject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignment dialog */}
      <Dialog open={assignDlg} onOpenChange={setAssignDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New teaching assignment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!assignClass || !assignSubject || !assignTeacher) {
                toast.error("Class, subject and teacher are required");
                return;
              }
              try {
                await sA({
                  data: {
                    classId: assignClass,
                    sectionId: assignSection === NONE ? null : assignSection,
                    subjectId: assignSubject,
                    teacherId: assignTeacher,
                  },
                });
                toast.success("Mapped");
                setAssignDlg(false);
                setAssignClass("");
                setAssignSection(NONE);
                setAssignSubject("");
                setAssignTeacher("");
                refresh();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label>Class</Label>
              <Select
                value={assignClass}
                onValueChange={(v) => {
                  setAssignClass(v);
                  setAssignSection(NONE);
                }}
              >
                <SelectTrigger>
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
              <Label>Section (optional)</Label>
              <Select value={assignSection} onValueChange={setAssignSection}>
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All sections</SelectItem>
                  {availableSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={assignTeacher} onValueChange={setAssignTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName ?? ""} · {t.employeeCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">Create mapping</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
