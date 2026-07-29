import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listComponents,
  saveComponent,
  deleteComponent,
  listTemplates,
  saveTemplate,
  deleteTemplate,
  listAssignments,
  saveAssignment,
  deleteAssignment,
  listPayslips,
  getPayslip,
  generatePayslips,
  finalizePayslip,
  payPayslip,
  deletePayslip,
} from "@/lib/payroll.functions";
import { listEmployees } from "@/lib/hrm.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, Pencil, FileText, Printer } from "lucide-react";
import { confirmDelete } from "@/lib/confirm";

export const Route = createFileRoute("/app/payroll")({ component: PayrollPage });

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

type Component = {
  id: string;
  name: string;
  code: string | null;
  kind: "earning" | "deduction";
  isPercentage: boolean;
  defaultValue: number;
  isActive: boolean;
};
type TemplateLink = {
  id: string;
  templateId: string;
  componentId: string;
  value: number;
  name: string | null;
  kind: "earning" | "deduction" | null;
  isPercentage: boolean | null;
};
type Template = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  components: TemplateLink[];
};
type Assignment = {
  id: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string | null;
  templateId: string;
  templateName: string | null;
  basic: number;
  effectiveFrom: string;
  isActive: boolean;
};
type Payslip = {
  id: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string | null;
  periodYear: number;
  periodMonth: number;
  basic: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: "draft" | "finalized" | "paid";
  paidVia: string | null;
};
type EmployeeLite = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
};

function PayrollPage() {
  const [tab, setTab] = useState<
    "payslips" | "assignments" | "templates" | "components"
  >("payslips");
  return (
    <div className="p-8">
      <PageHeader
        title="Payroll"
        description="Salary components, templates, employee assignments, and payslips."
      />
      <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-border bg-surface-muted p-1 text-sm w-fit">
        {(
          [
            ["payslips", "Payslips"],
            ["assignments", "Assignments"],
            ["templates", "Templates"],
            ["components", "Components"],
          ] as [
            "payslips" | "assignments" | "templates" | "components",
            string,
          ][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded px-3 py-1.5 font-medium transition ${
              tab === k
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "payslips" ? <PayslipsTab /> : null}
      {tab === "assignments" ? <AssignmentsTab /> : null}
      {tab === "templates" ? <TemplatesTab /> : null}
      {tab === "components" ? <ComponentsTab /> : null}
    </div>
  );
}

/* =============== COMPONENTS =============== */
function ComponentsTab() {
  const listFn = useServerFn(listComponents);
  const saveFn = useServerFn(saveComponent);
  const delFn = useServerFn(deleteComponent);
  const [rows, setRows] = useState<Component[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Component> | null>(null);

  async function reload() {
    try {
      setRows((await listFn()) as Component[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(fd: FormData) {
    try {
      await saveFn({
        data: {
          id: edit?.id,
          name: String(fd.get("name")),
          code: String(fd.get("code") || "") || null,
          kind: String(fd.get("kind")) as "earning" | "deduction",
          isPercentage: fd.get("isPercentage") === "on",
          defaultValue: Number(fd.get("defaultValue") || 0),
          isActive: fd.get("isActive") === "on",
        },
      });
      toast.success("Component saved");
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex">
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEdit({ kind: "earning", isActive: true, defaultValue: 0 });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> New Component
        </Button>
      </div>
      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No components. Add earnings (HRA, DA…) and deductions (PF, tax…).
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.code ?? "—"}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs capitalize ${
                      r.kind === "earning"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {r.kind}
                  </span>
                </TableCell>
                <TableCell>
                  {r.isPercentage ? `${r.defaultValue}%` : fmt(r.defaultValue)}
                </TableCell>
                <TableCell>{r.isPercentage ? "% of Basic" : "Flat"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEdit(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirmDelete("payroll record")) return;
                        try {
                          await delFn({ data: { id: r.id } });
                          toast.success("Deleted");
                          reload();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit Component" : "New Component"}
            </DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submit(fd);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input name="name" defaultValue={edit?.name ?? ""} required />
              </div>
              <div>
                <Label>Code</Label>
                <Input name="code" defaultValue={edit?.code ?? ""} />
              </div>
              <div>
                <Label>Kind</Label>
                <select
                  name="kind"
                  defaultValue={edit?.kind ?? "earning"}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>
              <div>
                <Label>Default value</Label>
                <Input
                  type="number"
                  name="defaultValue"
                  min={0}
                  defaultValue={edit?.defaultValue ?? 0}
                />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isPercentage"
                  defaultChecked={edit?.isPercentage ?? false}
                />
                Percentage of Basic
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={edit?.isActive ?? true}
                />
                Active
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =============== TEMPLATES =============== */
function TemplatesTab() {
  const listFn = useServerFn(listTemplates);
  const listCompFn = useServerFn(listComponents);
  const saveFn = useServerFn(saveTemplate);
  const delFn = useServerFn(deleteTemplate);
  const [rows, setRows] = useState<Template[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Template> | null>(null);
  const [lines, setLines] = useState<{ componentId: string; value: number }[]>(
    [],
  );

  async function reload() {
    try {
      const [t, c] = await Promise.all([listFn(), listCompFn()]);
      setRows(t as Template[]);
      setComponents(c as Component[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEdit({ isActive: true });
    setLines([]);
    setOpen(true);
  }
  function openEdit(t: Template) {
    setEdit(t);
    setLines(
      t.components.map((c) => ({ componentId: c.componentId, value: c.value })),
    );
    setOpen(true);
  }

  async function submit(fd: FormData) {
    try {
      await saveFn({
        data: {
          id: edit?.id,
          name: String(fd.get("name")),
          description: String(fd.get("description") || "") || null,
          isActive: fd.get("isActive") === "on",
          components: lines.filter((l) => l.componentId),
        },
      });
      toast.success("Template saved");
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex">
        <div className="flex-1" />
        <Button onClick={openNew}>
          <Plus className="mr-1 size-4" /> New Template
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 ? (
          <div className="col-span-2 rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No salary templates yet.
          </div>
        ) : null}
        {rows.map((t) => (
          <div
            key={t.id}
            className="rounded-md border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold">{t.name}</h3>
                {t.description ? (
                  <p className="text-xs text-muted-foreground">
                    {t.description}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(t)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("Delete this template?")) return;
                    try {
                      await delFn({ data: { id: t.id } });
                      toast.success("Deleted");
                      reload();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              {t.components.length === 0 ? (
                <div className="text-muted-foreground">No components.</div>
              ) : null}
              {t.components.map((c) => (
                <div key={c.id} className="flex justify-between">
                  <span
                    className={
                      c.kind === "deduction"
                        ? "text-rose-600"
                        : "text-emerald-700"
                    }
                  >
                    {c.name} {c.isPercentage ? "(% of Basic)" : ""}
                  </span>
                  <span className="font-mono">
                    {c.isPercentage ? `${c.value}%` : fmt(c.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit Template" : "New Template"}
            </DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submit(fd);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue={edit?.name ?? ""} required />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={edit?.isActive ?? true}
                />
                Active
              </label>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  name="description"
                  defaultValue={edit?.description ?? ""}
                  rows={2}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center">
                <div className="text-sm font-semibold">Components</div>
                <div className="flex-1" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLines([...lines, { componentId: "", value: 0 }])
                  }
                >
                  <Plus className="mr-1 size-4" /> Add row
                </Button>
              </div>
              <div className="space-y-2">
                {lines.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No component lines. Basic is included automatically at
                    payslip time.
                  </div>
                ) : null}
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={l.componentId}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], componentId: e.target.value };
                        setLines(next);
                      }}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select component…</option>
                      {components.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.kind})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      value={l.value}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], value: Number(e.target.value) };
                        setLines(next);
                      }}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setLines(lines.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =============== ASSIGNMENTS =============== */
function AssignmentsTab() {
  const listFn = useServerFn(listAssignments);
  const saveFn = useServerFn(saveAssignment);
  const delFn = useServerFn(deleteAssignment);
  const listEmpFn = useServerFn(listEmployees);
  const listTplFn = useServerFn(listTemplates);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Assignment> | null>(null);

  async function reload() {
    try {
      const [a, e, t] = await Promise.all([
        listFn(),
        listEmpFn({ data: { activeOnly: true } }),
        listTplFn(),
      ]);
      setRows(a as Assignment[]);
      setEmployees(e as EmployeeLite[]);
      setTemplates(t as Template[]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(fd: FormData) {
    try {
      await saveFn({
        data: {
          id: edit?.id,
          employeeId: String(fd.get("employeeId")),
          templateId: String(fd.get("templateId")),
          basic: Number(fd.get("basic") || 0),
          effectiveFrom: String(fd.get("effectiveFrom")),
          isActive: fd.get("isActive") === "on",
        },
      });
      toast.success("Assignment saved");
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex">
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEdit({ isActive: true, effectiveFrom: today(), basic: 0 });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> New Assignment
        </Button>
      </div>
      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Basic</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No salary assignments.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.employeeName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.employeeCode}
                  </div>
                </TableCell>
                <TableCell>{r.templateName}</TableCell>
                <TableCell className="font-mono">{fmt(r.basic)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.effectiveFrom}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      r.isActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.isActive ? "Active" : "Ended"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEdit(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm("Delete assignment?")) return;
                        try {
                          await delFn({ data: { id: r.id } });
                          toast.success("Deleted");
                          reload();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit Assignment" : "New Assignment"}
            </DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submit(fd);
            }}
            className="space-y-3"
          >
            <div>
              <Label>Employee</Label>
              <select
                name="employeeId"
                defaultValue={edit?.employeeId ?? ""}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} — {e.firstName} {e.lastName ?? ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Template</Label>
              <select
                name="templateId"
                defaultValue={edit?.templateId ?? ""}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select template…</option>
                {templates
                  .filter((t) => t.isActive)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Basic salary (₹)</Label>
                <Input
                  type="number"
                  name="basic"
                  min={0}
                  defaultValue={edit?.basic ?? 0}
                  required
                />
              </div>
              <div>
                <Label>Effective from</Label>
                <Input
                  type="date"
                  name="effectiveFrom"
                  defaultValue={edit?.effectiveFrom ?? today()}
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={edit?.isActive ?? true}
              />
              Active (deactivates any prior assignment for this employee)
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =============== PAYSLIPS =============== */
function PayslipsTab() {
  const now = new Date();
  const listFn = useServerFn(listPayslips);
  const genFn = useServerFn(generatePayslips);
  const finalizeFn = useServerFn(finalizePayslip);
  const payFn = useServerFn(payPayslip);
  const delFn = useServerFn(deletePayslip);
  const getFn = useServerFn(getPayslip);
  const [rows, setRows] = useState<Payslip[]>([]);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Payslip | null>(null);

  async function reload() {
    try {
      const data = await listFn({ data: { year, month } });
      setRows(data as Payslip[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function generate() {
    try {
      const res = await genFn({ data: { year, month } });
      toast.success(
        `Generated ${res.created} payslip(s), skipped ${res.skipped}`,
      );
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function view(id: string) {
    try {
      const data = await getFn({ data: { id } });
      setViewData(data);
      setViewOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function submitPay(fd: FormData) {
    if (!payTarget) return;
    try {
      await payFn({
        data: {
          id: payTarget.id,
          paidVia: String(fd.get("paidVia")),
          reference: String(fd.get("reference") || "") || null,
          note: String(fd.get("note") || "") || null,
        },
      });
      toast.success("Marked as paid");
      setPayOpen(false);
      setPayTarget(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const totals = useMemo(
    () => ({
      gross: rows.reduce((s, r) => s + r.grossEarnings, 0),
      ded: rows.reduce((s, r) => s + r.totalDeductions, 0),
      net: rows.reduce((s, r) => s + r.netPay, 0),
      paid: rows.filter((r) => r.status === "paid").length,
    }),
    [rows],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Year</Label>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <div>
          <Label className="text-xs">Month</Label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <Button variant="outline" onClick={reload}>
          Refresh
        </Button>
        <Button onClick={generate}>
          <Plus className="mr-1 size-4" /> Generate {MONTHS[month - 1]} {year}
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3">
        <StatCard label="Payslips" value={rows.length.toString()} />
        <StatCard label="Gross" value={fmt(totals.gross)} />
        <StatCard label="Deductions" value={fmt(totals.ded)} />
        <StatCard label="Net" value={fmt(totals.net)} accent />
      </div>

      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No payslips for this period. Assign salaries first, then click
                  Generate.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.employeeName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.employeeCode}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {MONTHS[r.periodMonth - 1]} {r.periodYear}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(r.basic)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(r.grossEarnings)}
                </TableCell>
                <TableCell className="text-right font-mono text-rose-600">
                  -{fmt(r.totalDeductions)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {fmt(r.netPay)}
                </TableCell>
                <TableCell>
                  <PayslipBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View"
                      onClick={() => view(r.id)}
                    >
                      <FileText className="size-4" />
                    </Button>
                    {r.status === "draft" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await finalizeFn({ data: { id: r.id } });
                            toast.success("Finalized");
                            reload();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        Finalize
                      </Button>
                    ) : null}
                    {r.status === "finalized" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPayTarget(r);
                          setPayOpen(true);
                        }}
                      >
                        Pay
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm("Delete this payslip?")) return;
                        try {
                          await delFn({ data: { id: r.id } });
                          toast.success("Deleted");
                          reload();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Payslip</DialogTitle>
          </DialogHeader>
          {viewData ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-semibold">
                    {viewData.employeeName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {viewData.employeeCode} · {viewData.designation ?? "—"}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">
                    {MONTHS[viewData.periodMonth - 1]} {viewData.periodYear}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {viewData.status}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Earnings
                </div>
                <div className="space-y-1 text-sm">
                  {viewData.items
                    .filter((i: any) => i.kind === "earning")
                    .map((i: any) => (
                      <div
                        key={i.id}
                        className="flex justify-between border-b border-border/40 py-1"
                      >
                        <span>{i.label}</span>
                        <span className="font-mono">{fmt(i.amount)}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Deductions
                </div>
                <div className="space-y-1 text-sm">
                  {viewData.items.filter((i: any) => i.kind === "deduction")
                    .length === 0 ? (
                    <div className="text-xs text-muted-foreground">None</div>
                  ) : null}
                  {viewData.items
                    .filter((i: any) => i.kind === "deduction")
                    .map((i: any) => (
                      <div
                        key={i.id}
                        className="flex justify-between border-b border-border/40 py-1 text-rose-600"
                      >
                        <span>{i.label}</span>
                        <span className="font-mono">-{fmt(i.amount)}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex justify-between rounded-md bg-surface-muted px-4 py-3">
                <span className="font-semibold">Net pay</span>
                <span className="font-mono text-lg font-semibold">
                  {fmt(viewData.netPay)}
                </span>
              </div>
              {viewData.paidVia ? (
                <div className="text-xs text-muted-foreground">
                  Paid via {viewData.paidVia}
                  {viewData.reference ? ` · ${viewData.reference}` : ""}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-1 size-4" /> Print
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pay {payTarget?.employeeName} ·{" "}
              {payTarget ? fmt(payTarget.netPay) : ""}
            </DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submitPay(fd);
            }}
            className="space-y-3"
          >
            <div>
              <Label>Payment method</Label>
              <select
                name="paidVia"
                required
                defaultValue="bank_transfer"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input name="reference" placeholder="UTR, cheque no, etc." />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea name="note" rows={2} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Mark paid</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-semibold ${
          accent ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PayslipBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "finalized"
      ? "bg-blue-500/10 text-blue-600"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded px-2 py-0.5 text-xs capitalize ${cls}`}>
      {status}
    </span>
  );
}
