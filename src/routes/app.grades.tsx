import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listGradeScales,
  saveGradeScale,
  deleteGradeScale,
  saveGradeBands,
} from "@/lib/grades.functions";
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
import { Plus, Trash2, Save, Star } from "lucide-react";

export const Route = createFileRoute("/app/grades")({
  component: GradesPage,
});

type Band = {
  name: string;
  minPercent: number;
  maxPercent: number;
  gpa: string | null;
  remark: string | null;
};

type Scale = {
  id: string;
  name: string;
  isDefault: boolean;
  bands: Band[];
};

const DEFAULT_BANDS: Band[] = [
  { name: "A+", minPercent: 90, maxPercent: 100, gpa: "4.0", remark: "Outstanding" },
  { name: "A", minPercent: 80, maxPercent: 89, gpa: "3.7", remark: "Excellent" },
  { name: "B+", minPercent: 70, maxPercent: 79, gpa: "3.3", remark: "Very Good" },
  { name: "B", minPercent: 60, maxPercent: 69, gpa: "3.0", remark: "Good" },
  { name: "C", minPercent: 50, maxPercent: 59, gpa: "2.5", remark: "Average" },
  { name: "D", minPercent: 35, maxPercent: 49, gpa: "2.0", remark: "Pass" },
  { name: "F", minPercent: 0, maxPercent: 34, gpa: "0.0", remark: "Fail" },
];

function GradesPage() {
  const lS = useServerFn(listGradeScales);
  const sS = useServerFn(saveGradeScale);
  const dS = useServerFn(deleteGradeScale);
  const sB = useServerFn(saveGradeBands);

  const [scales, setScales] = useState<Scale[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [editBands, setEditBands] = useState<Band[]>([]);
  const [dlg, setDlg] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = (await lS()) as Scale[];
      setScales(rows);
      if (!active && rows[0]) {
        setActive(rows[0].id);
        setEditBands(rows[0].bands.length > 0 ? rows[0].bands : DEFAULT_BANDS);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [lS, active]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const current = scales.find((s) => s.id === active);

  return (
    <div className="p-8">
      <PageHeader
        title="Grade Scales"
        description="Create grade bands used to compute grades on published marksheets."
        action={
          <Button onClick={() => setDlg(true)}>
            <Plus className="mr-2 size-4" /> New scale
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Scales</h3>
          </div>
          <div className="p-2">
            {scales.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                No grade scales yet.
              </div>
            ) : (
              scales.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive(s.id);
                    setEditBands(s.bands.length > 0 ? s.bands : DEFAULT_BANDS);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    active === s.id ? "bg-accent" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {s.isDefault && (
                      <Star className="size-3 fill-amber-400 text-amber-500" />
                    )}
                    {s.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.bands.length} bands
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          {current ? (
            <>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {current.name}
                  {current.isDefault && (
                    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      Default
                    </span>
                  )}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditBands([
                        ...editBands,
                        {
                          name: "",
                          minPercent: 0,
                          maxPercent: 0,
                          gpa: null,
                          remark: null,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-1 size-4" /> Add band
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Delete ${current.name}?`)) return;
                      try {
                        await dS({ data: { id: current.id } });
                        toast.success("Deleted");
                        setActive(null);
                        setEditBands([]);
                        refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="mr-1 size-4" /> Delete
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const bands = editBands.filter((b) => b.name.trim());
                      if (bands.length === 0) {
                        toast.error("Add at least one band");
                        return;
                      }
                      try {
                        await sB({
                          data: {
                            scaleId: current.id,
                            bands,
                          },
                        });
                        toast.success("Bands saved");
                        refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Save className="mr-1 size-4" /> Save bands
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade</TableHead>
                    <TableHead>Min %</TableHead>
                    <TableHead>Max %</TableHead>
                    <TableHead>GPA</TableHead>
                    <TableHead>Remark</TableHead>
                    <TableHead className="w-[1%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editBands.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          className="h-8"
                          value={b.name}
                          onChange={(e) => {
                            const next = [...editBands];
                            next[i] = { ...b, name: e.target.value };
                            setEditBands(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20"
                          value={b.minPercent}
                          onChange={(e) => {
                            const next = [...editBands];
                            next[i] = {
                              ...b,
                              minPercent: Number(e.target.value),
                            };
                            setEditBands(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20"
                          value={b.maxPercent}
                          onChange={(e) => {
                            const next = [...editBands];
                            next[i] = {
                              ...b,
                              maxPercent: Number(e.target.value),
                            };
                            setEditBands(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20"
                          value={b.gpa ?? ""}
                          onChange={(e) => {
                            const next = [...editBands];
                            next[i] = { ...b, gpa: e.target.value || null };
                            setEditBands(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          value={b.remark ?? ""}
                          onChange={(e) => {
                            const next = [...editBands];
                            next[i] = {
                              ...b,
                              remark: e.target.value || null,
                            };
                            setEditBands(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setEditBands(
                              editBands.filter((_, idx) => idx !== i),
                            )
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Select or create a grade scale.
            </div>
          )}
        </div>
      </div>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New grade scale</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                const res = (await sS({
                  data: {
                    name: String(fd.get("name") ?? ""),
                    isDefault: fd.get("isDefault") === "on",
                  },
                })) as { id: string };
                toast.success("Created");
                setDlg(false);
                await refresh();
                setActive(res.id);
                setEditBands(DEFAULT_BANDS);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="gs-name">Name</Label>
              <Input id="gs-name" name="name" required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDefault" /> Set as default scale
            </label>
            <DialogFooter>
              <Button type="submit">Create scale</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
