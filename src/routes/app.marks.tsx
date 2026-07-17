import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listExams, listExamSubjects } from "@/lib/exams.functions";
import { getMarksGrid, saveMarks, getExamResults } from "@/lib/marks.functions";
import { listClasses, listSections } from "@/lib/academic.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Save, ClipboardCheck, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/marks")({
  component: MarksPage,
});

const NONE = "__none__";

type Exam = { id: string; name: string; isPublished: boolean };
type ExamSubj = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  passMarks: number;
};
type Cls = { id: string; name: string };
type Sec = { id: string; classId: string; name: string };
type Row = {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  firstName: string;
  lastName: string | null;
  marksObtained: number | null;
  isAbsent: boolean;
  remark: string | null;
};
type Grid = {
  examSubject: ExamSubj;
  rows: Row[];
};
type ResultRow = {
  student: {
    id: string;
    admissionNo: string;
    rollNo: string | null;
    firstName: string;
    lastName: string | null;
  };
  subjects: Array<{
    subjectName: string;
    maxMarks: number;
    passMarks: number;
    marksObtained: number | null;
    isAbsent: boolean;
    pass: boolean;
  }>;
  totalObtained: number;
  totalMax: number;
  percent: number;
  grade: string;
  gpa: string | null;
  status: string;
  rank: number;
};
type Results = {
  exam: { id: string; name: string; isPublished: boolean };
  subjects: Array<{ subjectId: string; subjectName: string; maxMarks: number }>;
  results: ResultRow[];
};

function MarksPage() {
  const [tab, setTab] = useState<"entry" | "results">("entry");
  const lE = useServerFn(listExams);
  const lES = useServerFn(listExamSubjects);
  const lC = useServerFn(listClasses);
  const lSec = useServerFn(listSections);
  const gG = useServerFn(getMarksGrid);
  const sM = useServerFn(saveMarks);
  const gR = useServerFn(getExamResults);

  const [exams, setExams] = useState<Exam[]>([]);
  const [examSubs, setExamSubs] = useState<ExamSubj[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [sections, setSections] = useState<Sec[]>([]);

  const [examId, setExamId] = useState<string>("");
  const [examSubjectId, setExamSubjectId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>(NONE);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [saving, setSaving] = useState(false);

  // Results tab state
  const [rClass, setRClass] = useState<string>("");
  const [rSection, setRSection] = useState<string>(NONE);
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [es, cs, ss] = await Promise.all([lE(), lC(), lSec({ data: {} })]);
        setExams(es as Exam[]);
        setClasses(cs as Cls[]);
        setSections(ss as Sec[]);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [lE, lC, lSec]);

  useEffect(() => {
    if (!examId) {
      setExamSubs([]);
      setExamSubjectId("");
      return;
    }
    (async () => {
      try {
        const rows = (await lES({ data: { examId } })) as ExamSubj[];
        setExamSubs(rows);
        setExamSubjectId("");
        setGrid(null);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [examId, lES]);

  useEffect(() => {
    if (!examSubjectId) {
      setGrid(null);
      return;
    }
    (async () => {
      try {
        const g = (await gG({
          data: {
            examSubjectId,
            sectionId: sectionId === NONE ? null : sectionId,
          },
        })) as Grid;
        setGrid(g);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [examSubjectId, sectionId, gG]);

  const currentClassSections = grid
    ? sections.filter((s) => s.classId === grid.examSubject.classId)
    : [];

  async function handleSave() {
    if (!grid) return;
    setSaving(true);
    try {
      await sM({
        data: {
          examSubjectId: grid.examSubject.id,
          entries: grid.rows.map((r) => ({
            studentId: r.id,
            marksObtained: r.isAbsent ? null : r.marksObtained,
            isAbsent: r.isAbsent,
            remark: r.remark,
          })),
        },
      });
      toast.success("Marks saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function loadResults() {
    if (!examId || !rClass) {
      toast.error("Pick exam & class");
      return;
    }
    try {
      const r = (await gR({
        data: {
          examId,
          classId: rClass,
          sectionId: rSection === NONE ? null : rSection,
        },
      })) as Results;
      setResults(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const resultsSectionOptions = sections.filter((s) => s.classId === rClass);

  return (
    <div className="p-8">
      <PageHeader
        title="Marks & Results"
        description="Enter subject marks or compute a class result."
      />

      <div className="mb-6 flex gap-2 border-b">
        {(
          [
            { k: "entry", label: "Marks entry" },
            { k: "results", label: "Results" },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.k
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "entry" && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
            <div>
              <Label className="text-xs">Exam</Label>
              <Select value={examId || NONE} onValueChange={(v) => setExamId(v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Class · Subject</Label>
              <Select
                value={examSubjectId || NONE}
                onValueChange={(v) => setExamSubjectId(v === NONE ? "" : v)}
                disabled={!examId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      examId ? "Select subject" : "Pick an exam first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {examSubs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.className} — {s.subjectName} · /{s.maxMarks}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Section (optional)</Label>
              <Select value={sectionId} onValueChange={setSectionId} disabled={!grid}>
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All sections</SelectItem>
                  {currentClassSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {grid && (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">
                    {grid.examSubject.className} — {grid.examSubject.subjectName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Max {grid.examSubject.maxMarks} · Pass {grid.examSubject.passMarks}
                  </div>
                </div>
                <Button onClick={handleSave} disabled={saving || grid.rows.length === 0}>
                  <Save className="mr-2 size-4" /> {saving ? "Saving…" : "Save marks"}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-32">Marks</TableHead>
                    <TableHead className="w-24">Absent</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No active students in this class{sectionId !== NONE ? "/section" : ""}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    grid.rows.map((r, i) => {
                      const invalid =
                        !r.isAbsent &&
                        r.marksObtained !== null &&
                        r.marksObtained > grid.examSubject.maxMarks;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">
                            {r.rollNo ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {r.firstName} {r.lastName ?? ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.admissionNo}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={grid.examSubject.maxMarks}
                              className={`h-8 ${invalid ? "border-destructive" : ""}`}
                              value={r.marksObtained ?? ""}
                              disabled={r.isAbsent}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : Number(e.target.value);
                                const next = [...grid.rows];
                                next[i] = { ...r, marksObtained: val };
                                setGrid({ ...grid, rows: next });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={r.isAbsent}
                                onChange={(e) => {
                                  const next = [...grid.rows];
                                  next[i] = {
                                    ...r,
                                    isAbsent: e.target.checked,
                                    marksObtained: e.target.checked ? null : r.marksObtained,
                                  };
                                  setGrid({ ...grid, rows: next });
                                }}
                              />
                              Absent
                            </label>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              value={r.remark ?? ""}
                              onChange={(e) => {
                                const next = [...grid.rows];
                                next[i] = { ...r, remark: e.target.value || null };
                                setGrid({ ...grid, rows: next });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
            <div>
              <Label className="text-xs">Exam</Label>
              <Select value={examId || NONE} onValueChange={(v) => setExamId(v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Class</Label>
              <Select
                value={rClass || NONE}
                onValueChange={(v) => {
                  setRClass(v === NONE ? "" : v);
                  setRSection(NONE);
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
              <Label className="text-xs">Section (optional)</Label>
              <Select value={rSection} onValueChange={setRSection} disabled={!rClass}>
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All sections</SelectItem>
                  {resultsSectionOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadResults} className="w-full">
                <ClipboardCheck className="mr-2 size-4" /> Compute results
              </Button>
            </div>
          </div>

          {results && (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-sm font-semibold">
                  {results.exam.name} · {results.results.length} students
                </div>
                {!results.exam.isPublished && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                    Draft — publish exam to share marksheets
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      {results.subjects.map((s) => (
                        <TableHead key={s.subjectId} className="text-center">
                          <div className="text-xs">{s.subjectName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            /{s.maxMarks}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Result</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.results.map((r) => (
                      <TableRow key={r.student.id}>
                        <TableCell className="font-mono">{r.rank}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {r.student.firstName} {r.student.lastName ?? ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.student.admissionNo}
                          </div>
                        </TableCell>
                        {r.subjects.map((s, i) => (
                          <TableCell
                            key={i}
                            className={`text-center ${
                              s.isAbsent
                                ? "text-muted-foreground"
                                : s.pass
                                  ? ""
                                  : "text-destructive"
                            }`}
                          >
                            {s.isAbsent ? "AB" : (s.marksObtained ?? "—")}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-medium">
                          {r.totalObtained}/{r.totalMax}
                        </TableCell>
                        <TableCell className="text-center">{r.percent.toFixed(2)}%</TableCell>
                        <TableCell className="text-center font-semibold">
                          {r.grade}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              r.status === "PASS"
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-red-500/15 text-red-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {results.exam.isPublished ? (
                            <a
                              href={`/marksheet/${results.exam.id}/${r.student.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Marksheet <ExternalLink className="inline size-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
