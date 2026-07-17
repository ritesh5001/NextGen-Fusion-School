import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listExams,
  saveExam,
  deleteExam,
  setExamPublished,
  listExamSubjects,
  saveExamSubject,
  deleteExamSubject,
} from "@/lib/exams.functions";
import { listGradeScales } from "@/lib/grades.functions";
import { listAcademicYears, listClasses } from "@/lib/academic.functions";
import { listSubjects } from "@/lib/subjects.functions";
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
import {
  Plus,
  Pencil,
  Trash2,
  Layers,
  Send,
  EyeOff,
  FileSpreadsheet,
} from "lucide-react";

export const Route = createFileRoute("/app/exams")({
  component: ExamsPage,
});

const NONE = "__none__";

type Exam = {
  id: string;
  name: string;
  term: string | null;
  startsOn: string | null;
  endsOn: string | null;
  isPublished: boolean;
  academicYearId: string | null;
  gradeScaleId: string | null;
  yearName: string | null;
};

type ExamSubj = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  passMarks: number;
  examDate: string | null;
};

function ExamsPage() {
  const lE = useServerFn(listExams);
  const sE = useServerFn(saveExam);
  const dE = useServerFn(deleteExam);
  const pE = useServerFn(setExamPublished);
  const lY = useServerFn(listAcademicYears);
  const lGS = useServerFn(listGradeScales);
  const lC = useServerFn(listClasses);
  const lS = useServerFn(listSubjects);
  const lES = useServerFn(listExamSubjects);
  const sES = useServerFn(saveExamSubject);
  const dES = useServerFn(deleteExamSubject);

  const [exams, setExams] = useState<Exam[]>([]);
  const [years, setYears] = useState<{ id: string; name: string }[]>([]);
  const [scales, setScales] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<
    { id: string; name: string; code: string | null }[]
  >([]);

  const [dlg, setDlg] = useState<{ open: boolean; edit: Exam | null }>({
    open: false,
    edit: null,
  });
  const [subDlg, setSubDlg] = useState<Exam | null>(null);
  const [subs, setSubs] = useState<ExamSubj[]>([]);
  const [addSub, setAddSub] = useState({
    classId: "",
    subjectId: "",
    maxMarks: 100,
    passMarks: 35,
    examDate: "",
  });

  const refresh = useCallback(async () => {
    try {
      setExams((await lE()) as Exam[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [lE]);

  useEffect(() => {
    (async () => {
      try {
        const [ys, gs, cs, ss] = await Promise.all([
          lY(),
          lGS(),
          lC(),
          lS(),
        ]);
        setYears(ys as { id: string; name: string }[]);
        setScales((gs as { id: string; name: string }[]).map((g) => ({ id: g.id, name: g.name })));
        setClasses(cs as { id: string; name: string }[]);
        setSubjects(
          ss as { id: string; name: string; code: string | null }[],
        );
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    refresh();
  }, [lY, lGS, lC, lS, refresh]);

  async function loadSubjectsFor(exam: Exam) {
    try {
      setSubs((await lES({ data: { examId: exam.id } })) as ExamSubj[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Exams & Marks"
        description="Set up exams, map subjects per class, and publish marksheets."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/app/grades">Grade scales</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/marks">Enter marks</Link>
            </Button>
            <Button onClick={() => setDlg({ open: true, edit: null })}>
              <Plus className="mr-2 size-4" /> New exam
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[1%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No exams yet.
                </TableCell>
              </TableRow>
            ) : (
              exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.term ?? "—"}</TableCell>
                  <TableCell>{e.yearName ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.startsOn ?? "—"} → {e.endsOn ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        e.isPublished
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {e.isPublished ? "Published" : "Draft"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Manage subjects"
                      onClick={() => {
                        setSubDlg(e);
                        loadSubjectsFor(e);
                      }}
                    >
                      <Layers className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={e.isPublished ? "Unpublish" : "Publish"}
                      onClick={async () => {
                        try {
                          await pE({
                            data: {
                              id: e.id,
                              isPublished: !e.isPublished,
                            },
                          });
                          toast.success(
                            e.isPublished ? "Unpublished" : "Published",
                          );
                          refresh();
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    >
                      {e.isPublished ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDlg({ open: true, edit: e })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete exam "${e.name}"?`)) return;
                        try {
                          await dE({ data: { id: e.id } });
                          toast.success("Deleted");
                          refresh();
                        } catch (err) {
                          toast.error((err as Error).message);
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

      {/* Exam create / edit */}
      <Dialog
        open={dlg.open}
        onOpenChange={(o) => setDlg({ open: o, edit: dlg.edit })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.edit ? "Edit exam" : "New exam"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              try {
                await sE({
                  data: {
                    id: dlg.edit?.id,
                    name: String(fd.get("name") ?? ""),
                    term: String(fd.get("term") ?? "") || null,
                    academicYearId:
                      String(fd.get("academicYearId") ?? "") || null,
                    gradeScaleId:
                      String(fd.get("gradeScaleId") ?? "") || null,
                    startsOn: String(fd.get("startsOn") ?? "") || null,
                    endsOn: String(fd.get("endsOn") ?? "") || null,
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
              <Label htmlFor="ex-name">Name</Label>
              <Input
                id="ex-name"
                name="name"
                required
                defaultValue={dlg.edit?.name ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ex-term">Term</Label>
                <Input
                  id="ex-term"
                  name="term"
                  defaultValue={dlg.edit?.term ?? ""}
                  placeholder="e.g. Mid-term"
                />
              </div>
              <div>
                <Label>Academic year</Label>
                <select
                  name="academicYearId"
                  defaultValue={dlg.edit?.academicYearId ?? ""}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ex-start">Starts on</Label>
                <Input
                  id="ex-start"
                  name="startsOn"
                  type="date"
                  defaultValue={dlg.edit?.startsOn ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="ex-end">Ends on</Label>
                <Input
                  id="ex-end"
                  name="endsOn"
                  type="date"
                  defaultValue={dlg.edit?.endsOn ?? ""}
                />
              </div>
            </div>
            <div>
              <Label>Grade scale</Label>
              <select
                name="gradeScaleId"
                defaultValue={dlg.edit?.gradeScaleId ?? ""}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                {scales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit">Save exam</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subjects manager */}
      <Dialog open={!!subDlg} onOpenChange={(o) => !o && setSubDlg(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              <FileSpreadsheet className="mr-2 inline size-4" />
              Subjects — {subDlg?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>Pass</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[1%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-xs text-muted-foreground"
                    >
                      No subjects mapped yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.className}</TableCell>
                      <TableCell>{s.subjectName}</TableCell>
                      <TableCell>{s.maxMarks}</TableCell>
                      <TableCell>{s.passMarks}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.examDate ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm("Remove mapping?")) return;
                            try {
                              await dES({ data: { id: s.id } });
                              if (subDlg) loadSubjectsFor(subDlg);
                            } catch (err) {
                              toast.error((err as Error).message);
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

          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!subDlg) return;
              if (!addSub.classId || !addSub.subjectId) {
                toast.error("Class & subject required");
                return;
              }
              try {
                await sES({
                  data: {
                    examId: subDlg.id,
                    classId: addSub.classId,
                    subjectId: addSub.subjectId,
                    maxMarks: Number(addSub.maxMarks),
                    passMarks: Number(addSub.passMarks),
                    examDate: addSub.examDate || null,
                  },
                });
                setAddSub({
                  classId: "",
                  subjectId: "",
                  maxMarks: 100,
                  passMarks: 35,
                  examDate: "",
                });
                loadSubjectsFor(subDlg);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="grid grid-cols-6 items-end gap-2 rounded-md border bg-muted/30 p-3"
          >
            <div className="col-span-2">
              <Label className="text-xs">Class</Label>
              <Select
                value={addSub.classId || NONE}
                onValueChange={(v) =>
                  setAddSub({ ...addSub, classId: v === NONE ? "" : v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Class" />
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
            <div className="col-span-2">
              <Label className="text-xs">Subject</Label>
              <Select
                value={addSub.subjectId || NONE}
                onValueChange={(v) =>
                  setAddSub({ ...addSub, subjectId: v === NONE ? "" : v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Subject" />
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
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                min={1}
                value={addSub.maxMarks}
                onChange={(e) =>
                  setAddSub({ ...addSub, maxMarks: Number(e.target.value) })
                }
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Pass</Label>
              <Input
                type="number"
                min={0}
                value={addSub.passMarks}
                onChange={(e) =>
                  setAddSub({ ...addSub, passMarks: Number(e.target.value) })
                }
                className="h-9"
              />
            </div>
            <div className="col-span-5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={addSub.examDate}
                onChange={(e) =>
                  setAddSub({ ...addSub, examDate: e.target.value })
                }
                className="h-9"
              />
            </div>
            <Button type="submit" className="h-9">
              <Plus className="mr-1 size-4" /> Add
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
