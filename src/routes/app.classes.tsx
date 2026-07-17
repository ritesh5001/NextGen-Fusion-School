import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listClasses,
  saveClass,
  deleteClass,
  listSections,
  saveSection,
  deleteSection,
  listAcademicYears,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/classes")({
  component: ClassesPage,
});

type Year = { id: string; name: string; isCurrent: boolean };
type ClassRow = {
  id: string;
  name: string;
  numericGrade: number | null;
  academicYearId: string;
  academicYearName: string | null;
  sectionCount: number;
};
type SectionRow = {
  id: string;
  classId: string;
  name: string;
  capacity: number;
};

function ClassesPage() {
  const listY = useServerFn(listAcademicYears);
  const listC = useServerFn(listClasses);
  const saveC = useServerFn(saveClass);
  const delC = useServerFn(deleteClass);
  const listS = useServerFn(listSections);
  const saveS = useServerFn(saveSection);
  const delS = useServerFn(deleteSection);

  const [years, setYears] = useState<Year[]>([]);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [sectionsByClass, setSectionsByClass] = useState<Record<string, SectionRow[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [classDlg, setClassDlg] = useState<{ open: boolean; edit: ClassRow | null }>({
    open: false,
    edit: null,
  });
  const [sectionDlg, setSectionDlg] = useState<{
    open: boolean;
    classId: string | null;
    edit: SectionRow | null;
  }>({ open: false, classId: null, edit: null });

  async function refresh() {
    try {
      const [ys, cs] = await Promise.all([listY(), listC()]);
      setYears(ys as Year[]);
      setClasses(cs as ClassRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleExpand(classId: string) {
    const next = new Set(expanded);
    if (next.has(classId)) {
      next.delete(classId);
    } else {
      next.add(classId);
      if (!sectionsByClass[classId]) {
        try {
          const s = (await listS({ data: { classId } })) as SectionRow[];
          setSectionsByClass((prev) => ({ ...prev, [classId]: s }));
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
    }
    setExpanded(next);
  }

  async function refreshSections(classId: string) {
    const s = (await listS({ data: { classId } })) as SectionRow[];
    setSectionsByClass((prev) => ({ ...prev, [classId]: s }));
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Classes & Sections"
        description="Organize grade levels and their sections with seat capacity."
        action={
          <Button
            onClick={() => setClassDlg({ open: true, edit: null })}
            disabled={years.length === 0}
          >
            <Plus className="mr-2 size-4" /> Add class
          </Button>
        }
      />

      {years.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Create an academic year first, then add classes.
          </p>
        </Card>
      ) : classes === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : classes.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">No classes yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {classes.map((c) => {
            const isOpen = expanded.has(c.id);
            const sections = sectionsByClass[c.id] ?? [];
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => toggleExpand(c.id)}
                    className="rounded-md p-1 hover:bg-muted"
                    aria-label="Toggle sections"
                  >
                    {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.name}</span>
                      {c.numericGrade !== null && (
                        <Badge variant="secondary">Grade {c.numericGrade}</Badge>
                      )}
                      <Badge variant="outline">{c.academicYearName}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.sectionCount} section{c.sectionCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSectionDlg({ open: true, classId: c.id, edit: null })
                    }
                  >
                    <Plus className="mr-1 size-3.5" /> Section
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setClassDlg({ open: true, edit: c })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm(`Delete class "${c.name}"?`)) return;
                      try {
                        await delC({ data: { id: c.id } });
                        toast.success("Deleted");
                        refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                {isOpen && (
                  <div className="border-t bg-muted/20 p-4">
                    {sections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sections yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {sections.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-md border bg-background p-2.5"
                          >
                            <div>
                              <div className="text-sm font-medium">Section {s.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Capacity: {s.capacity}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setSectionDlg({
                                    open: true,
                                    classId: c.id,
                                    edit: s,
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (!confirm(`Delete section ${s.name}?`)) return;
                                  try {
                                    await delS({ data: { id: s.id } });
                                    toast.success("Deleted");
                                    refreshSections(c.id);
                                    refresh();
                                  } catch (e) {
                                    toast.error((e as Error).message);
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Class dialog */}
      <Dialog
        open={classDlg.open}
        onOpenChange={(o) => setClassDlg({ open: o, edit: classDlg.edit })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {classDlg.edit ? "Edit class" : "New class"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                const gradeVal = fd.get("numericGrade");
                await saveC({
                  data: {
                    id: classDlg.edit?.id,
                    academicYearId: String(fd.get("academicYearId") ?? ""),
                    name: String(fd.get("name") ?? ""),
                    numericGrade: gradeVal ? Number(gradeVal) : undefined,
                  },
                });
                toast.success("Saved");
                setClassDlg({ open: false, edit: null });
                refresh();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="name">Class name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Class 10"
                defaultValue={classDlg.edit?.name ?? ""}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="numericGrade">Grade level</Label>
                <Input
                  id="numericGrade"
                  name="numericGrade"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="10"
                  defaultValue={classDlg.edit?.numericGrade ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="academicYearId">Academic year</Label>
                <Select
                  name="academicYearId"
                  defaultValue={
                    classDlg.edit?.academicYearId ??
                    years.find((y) => y.isCurrent)?.id ??
                    years[0]?.id
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Section dialog */}
      <Dialog
        open={sectionDlg.open}
        onOpenChange={(o) =>
          setSectionDlg({ open: o, classId: sectionDlg.classId, edit: sectionDlg.edit })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sectionDlg.edit ? "Edit section" : "New section"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const classId = sectionDlg.classId!;
              try {
                await saveS({
                  data: {
                    id: sectionDlg.edit?.id,
                    classId,
                    name: String(fd.get("name") ?? ""),
                    capacity: Number(fd.get("capacity") ?? 40),
                  },
                });
                toast.success("Saved");
                setSectionDlg({ open: false, classId: null, edit: null });
                refreshSections(classId);
                refresh();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="s-name">Section name</Label>
                <Input
                  id="s-name"
                  name="name"
                  placeholder="A"
                  defaultValue={sectionDlg.edit?.name ?? ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="capacity">Seat capacity</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  max={500}
                  defaultValue={sectionDlg.edit?.capacity ?? 40}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
