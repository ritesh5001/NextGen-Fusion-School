import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getStudentAttendance,
  markStudentAttendance,
  monthlyStudentReport,
  getEmployeeAttendance,
  markEmployeeAttendance,
} from "@/lib/attendance.functions";
import { listClasses, listSections } from "@/lib/academic.functions";
import { PageHeader } from "@/components/page-header";
import { UpgradeNudge } from "@/components/upgrade";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, CalendarCheck, FileBarChart2, UserCog } from "lucide-react";

export const Route = createFileRoute("/app/attendance")({
  component: AttendancePage,
});

type ClassOpt = { id: string; name: string };
type SectionOpt = { id: string; classId: string; name: string };
type Status = "present" | "absent" | "late" | "excused";
type RosterRow = {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  firstName: string;
  lastName: string | null;
  status: Status | null;
  note: string | null;
};
type MonthlyRow = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string | null;
  present: number;
  absent: number;
  late: number;
  excused: number;
};
type EmpRow = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  status: Status | null;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

function AttendancePage() {
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const lC = useServerFn(listClasses);
  const lSec = useServerFn(listSections);

  useEffect(() => {
    (async () => {
      try {
        const [cs, ss] = await Promise.all([lC(), lSec({ data: {} })]);
        setClasses(
          (cs as { id: string; name: string }[]).map((c) => ({
            id: c.id,
            name: c.name,
          })),
        );
        setSections(ss as SectionOpt[]);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [lC, lSec]);

  return (
    <div className="p-8">
      <PageHeader
        title="Attendance"
        description="Daily attendance marking and monthly reports."
      />

      <UpgradeNudge
        requiredPlan="pro"
        feature="Cross-class attendance analytics and printable report exports"
        className="mb-6"
      />

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">
            <CalendarCheck className="mr-2 size-4" /> Daily marking
          </TabsTrigger>
          <TabsTrigger value="monthly">
            <FileBarChart2 className="mr-2 size-4" /> Monthly report
          </TabsTrigger>
          <TabsTrigger value="employee">
            <UserCog className="mr-2 size-4" /> Employee
          </TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <DailyMarker classes={classes} sections={sections} />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyReport classes={classes} sections={sections} />
        </TabsContent>
        <TabsContent value="employee">
          <EmployeeMarker />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =============== DAILY MARKER =============== */
function DailyMarker({
  classes,
  sections,
}: {
  classes: ClassOpt[];
  sections: SectionOpt[];
}) {
  const get = useServerFn(getStudentAttendance);
  const mark = useServerFn(markStudentAttendance);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) return;
    try {
      const r = (await get({ data: { sectionId, date } })) as RosterRow[];
      setRows(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [get, sectionId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const availableSections = sections.filter((s) => s.classId === classId);

  function setAll(status: Status) {
    if (!rows) return;
    setRows(rows.map((r) => ({ ...r, status })));
  }
  function setOne(id: string, status: Status) {
    if (!rows) return;
    setRows(rows.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function save() {
    if (!rows || !sectionId) return;
    const entries = rows
      .filter((r) => r.status !== null)
      .map((r) => ({ studentId: r.id, status: r.status!, note: r.note }));
    if (entries.length === 0) {
      toast.error("Nothing to save — mark at least one student");
      return;
    }
    setSaving(true);
    try {
      await mark({ data: { sectionId, date, entries } });
      toast.success(`Saved ${entries.length} entries`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div>
          <Label className="text-xs">Class</Label>
          <Select
            value={classId}
            onValueChange={(v) => {
              setClassId(v);
              setSectionId("");
              setRows(null);
            }}
          >
            <SelectTrigger className="w-[180px]">
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
        <div>
          <Label className="text-xs">Section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {availableSections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll("present")} disabled={!rows}>
            Mark all present
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll("absent")} disabled={!rows}>
            Mark all absent
          </Button>
          <Button onClick={save} disabled={saving || !rows}>
            <Save className="mr-2 size-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Admission #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!sectionId ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Pick a class and section to load roster.
                </TableCell>
              </TableRow>
            ) : rows === null ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No students in this section.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="w-16 font-mono text-xs">
                    {r.rollNo ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.firstName} {r.lastName ?? ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.admissionNo}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(["present", "absent", "late", "excused"] as Status[]).map(
                        (s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={r.status === s ? "default" : "outline"}
                            onClick={() => setOne(r.id, s)}
                          >
                            {s[0].toUpperCase()}
                          </Button>
                        ),
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.note ?? ""}
                      onChange={(e) =>
                        setRows(
                          rows.map((x) =>
                            x.id === r.id ? { ...x, note: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="Optional note"
                      className="h-8"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* =============== MONTHLY REPORT =============== */
function MonthlyReport({
  classes,
  sections,
}: {
  classes: ClassOpt[];
  sections: SectionOpt[];
}) {
  const getReport = useServerFn(monthlyStudentReport);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(today());
  const [rows, setRows] = useState<MonthlyRow[] | null>(null);

  const availableSections = sections.filter((s) => s.classId === classId);

  async function run() {
    if (!sectionId) return;
    try {
      const r = (await getReport({
        data: { sectionId, start, end },
      })) as MonthlyRow[];
      setRows(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div>
          <Label className="text-xs">Class</Label>
          <Select
            value={classId}
            onValueChange={(v) => {
              setClassId(v);
              setSectionId("");
            }}
          >
            <SelectTrigger className="w-[180px]">
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
        <div>
          <Label className="text-xs">Section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {availableSections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={!sectionId}>
            Run report
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Admission #</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Late</TableHead>
              <TableHead className="text-right">Excused</TableHead>
              <TableHead className="text-right">% Present</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Choose section and range, then run report.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const total = r.present + r.absent + r.late + r.excused;
                const pct = total
                  ? Math.round(((r.present + r.late) / total) * 100)
                  : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.firstName} {r.lastName ?? ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.admissionNo}
                    </TableCell>
                    <TableCell className="text-right">{r.present}</TableCell>
                    <TableCell className="text-right">{r.absent}</TableCell>
                    <TableCell className="text-right">{r.late}</TableCell>
                    <TableCell className="text-right">{r.excused}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {total ? `${pct}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* =============== EMPLOYEE MARKER =============== */
function EmployeeMarker() {
  const get = useServerFn(getEmployeeAttendance);
  const mark = useServerFn(markEmployeeAttendance);
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<EmpRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = (await get({ data: { date } })) as EmpRow[];
      setRows(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [get, date]);

  useEffect(() => {
    load();
  }, [load]);

  function setOne(id: string, patch: Partial<EmpRow>) {
    if (!rows) return;
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!rows) return;
    const entries = rows
      .filter((r) => r.status !== null)
      .map((r) => ({
        teacherId: r.id,
        status: r.status!,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        note: r.note,
      }));
    if (entries.length === 0) {
      toast.error("Nothing to save");
      return;
    }
    setSaving(true);
    try {
      await mark({ data: { date, entries } });
      toast.success(`Saved ${entries.length} entries`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-3 rounded-lg border bg-card p-4">
        <div>
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <div className="ml-auto flex items-end">
          <Button onClick={save} disabled={saving || !rows}>
            <Save className="mr-2 size-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check in</TableHead>
              <TableHead>Check out</TableHead>
              <TableHead>Note</TableHead>
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
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.employeeCode}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.firstName} {r.lastName ?? ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(["present", "absent", "late", "excused"] as Status[]).map(
                        (s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={r.status === s ? "default" : "outline"}
                            onClick={() => setOne(r.id, { status: s })}
                          >
                            {s[0].toUpperCase()}
                          </Button>
                        ),
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={r.checkIn ?? ""}
                      onChange={(e) => setOne(r.id, { checkIn: e.target.value })}
                      className="h-8 w-[120px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={r.checkOut ?? ""}
                      onChange={(e) => setOne(r.id, { checkOut: e.target.value })}
                      className="h-8 w-[120px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.note ?? ""}
                      onChange={(e) => setOne(r.id, { note: e.target.value })}
                      placeholder="Optional"
                      className="h-8"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
