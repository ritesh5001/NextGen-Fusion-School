import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listPromotionCandidates,
  promoteStudents,
} from "@/lib/promotion.functions";
import {
  listAcademicYears,
  listClasses,
  listSections,
} from "@/lib/academic.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRightCircle, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/app/promotion")({
  component: PromotionPage,
});

type Year = { id: string; name: string; isCurrent: boolean };
type Cls = { id: string; name: string; academicYearId: string };
type Sec = { id: string; classId: string; name: string };
type Cand = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string | null;
  rollNo: string | null;
  classId: string | null;
  sectionId: string | null;
};

function PromotionPage() {
  const listY = useServerFn(listAcademicYears);
  const listC = useServerFn(listClasses);
  const listS = useServerFn(listSections);
  const listCand = useServerFn(listPromotionCandidates);
  const promote = useServerFn(promoteStudents);

  const [years, setYears] = useState<Year[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [sections, setSections] = useState<Sec[]>([]);
  const [fromClassId, setFromClassId] = useState<string>("");
  const [toYearId, setToYearId] = useState<string>("");
  const [toClassId, setToClassId] = useState<string>("");
  const [toSectionId, setToSectionId] = useState<string>("");
  const [outcome, setOutcome] = useState<"promoted" | "retained" | "alumni">(
    "promoted",
  );
  const [cands, setCands] = useState<Cand[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [y, c, s] = await Promise.all([
          listY(),
          listC(),
          listS({ data: {} }),
        ]);
        setYears(y as Year[]);
        setClasses(c as Cls[]);
        setSections(s as Sec[]);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!fromClassId) {
        setCands([]);
        return;
      }
      try {
        const rows = (await listCand({
          data: { classId: fromClassId },
        })) as Cand[];
        setCands(rows);
        setSelected(new Set(rows.map((r) => r.id)));
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromClassId]);

  const toClasses = classes.filter((c) => c.academicYearId === toYearId);
  const toSections = sections.filter((s) => s.classId === toClassId);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function run() {
    if (selected.size === 0) return toast.error("Select at least one student");
    if (!toYearId) return toast.error("Choose the destination academic year");
    if (outcome === "promoted" && !toClassId)
      return toast.error("Choose destination class");
    if (
      !confirm(
        `Apply ${outcome} to ${selected.size} student${selected.size === 1 ? "" : "s"}?`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = (await promote({
        data: {
          toAcademicYearId: toYearId,
          toClassId: outcome === "promoted" ? toClassId : null,
          toSectionId: outcome === "promoted" ? toSectionId || null : null,
          outcome,
          studentIds: Array.from(selected),
        },
      })) as { moved: number };
      toast.success(`${outcome === "alumni" ? "Marked alumni" : outcome} — ${res.moved} student${res.moved === 1 ? "" : "s"}`);
      setSelected(new Set());
      setCands([]);
      setFromClassId("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Promotion"
        description="Move students to the next academic year, class, or mark them as alumni."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source */}
        <div className="rounded-md border border-border bg-background p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="size-4 text-primary" />
            Source
          </div>
          <Label>From class</Label>
          <Select value={fromClassId} onValueChange={setFromClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => {
                const yr = years.find((y) => y.id === c.academicYearId);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {yr?.name ?? "—"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="mt-3 text-xs text-muted-foreground">
            {cands.length} student{cands.length === 1 ? "" : "s"} eligible.
          </p>
        </div>

        {/* Destination */}
        <div className="rounded-md border border-border bg-background p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ArrowRightCircle className="size-4 text-primary" />
            Destination
          </div>
          <div className="space-y-3">
            <div>
              <Label>Outcome</Label>
              <div className="mt-1 flex gap-2">
                {(
                  [
                    ["promoted", "Promote"],
                    ["retained", "Retain"],
                    ["alumni", "Alumni"],
                  ] as [typeof outcome, string][]
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setOutcome(k)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
                      outcome === k
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>To academic year</Label>
              <Select value={toYearId} onValueChange={setToYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                      {y.isCurrent ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {outcome === "promoted" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>To class</Label>
                  <Select
                    value={toClassId}
                    onValueChange={(v) => {
                      setToClassId(v);
                      setToSectionId("");
                    }}
                    disabled={!toYearId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose class" />
                    </SelectTrigger>
                    <SelectContent>
                      {toClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>To section</Label>
                  <Select
                    value={toSectionId || "__none__"}
                    onValueChange={(v) =>
                      setToSectionId(v === "__none__" ? "" : v)
                    }
                    disabled={!toClassId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— none —</SelectItem>
                      {toSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">
            Students {selected.size > 0 && `· ${selected.size} selected`}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelected(
                  selected.size === cands.length
                    ? new Set()
                    : new Set(cands.map((c) => c.id)),
                )
              }
              disabled={cands.length === 0}
            >
              {selected.size === cands.length && cands.length > 0
                ? "Clear all"
                : "Select all"}
            </Button>
            <Button
              onClick={run}
              disabled={busy || selected.size === 0 || !toYearId}
            >
              {busy ? "Applying…" : `Apply ${outcome}`}
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Admission</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cands.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {c.admissionNo}
                </TableCell>
                <TableCell>{c.rollNo ?? "—"}</TableCell>
                <TableCell>
                  {c.firstName} {c.lastName ?? ""}
                </TableCell>
              </TableRow>
            ))}
            {cands.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  Choose a source class to load students.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
