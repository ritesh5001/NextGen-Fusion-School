import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listFeeHeads,
  saveFeeHead,
  deleteFeeHead,
  listFeeStructures,
  saveFeeStructure,
  deleteFeeStructure,
  listInvoices,
  createInvoice,
  cancelInvoice,
  getInvoice,
  recordPayment,
  generateInvoicesFromStructure,
  dueReport,
} from "@/lib/fees.functions";
import { listAccountHeads } from "@/lib/accounts.functions";
import { listAcademicYears, listClasses } from "@/lib/academic.functions";
import { listStudents } from "@/lib/students.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, X, Ban, Receipt, Printer } from "lucide-react";

export const Route = createFileRoute("/app/fees")({ component: FeesPage });

type Tab = "heads" | "structures" | "invoices" | "due";

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(d: string, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x.toISOString().slice(0, 10);
}

function FeesPage() {
  const [tab, setTab] = useState<Tab>("invoices");
  return (
    <div className="p-8">
      <PageHeader
        title="Fees"
        description="Fee heads, structures, invoices and collections."
      />
      <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-border bg-surface-muted p-1 text-sm w-fit">
        {(
          [
            ["invoices", "Invoices"],
            ["structures", "Fee Structures"],
            ["heads", "Fee Heads"],
            ["due", "Due Report"],
          ] as [Tab, string][]
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

      {tab === "heads" && <FeeHeadsTab />}
      {tab === "structures" && <StructuresTab />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "due" && <DueTab />}
    </div>
  );
}

/* -------------------- Fee heads -------------------- */
type Head = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isRecurring: boolean;
  isActive: boolean;
};

function FeeHeadsTab() {
  const list = useServerFn(listFeeHeads);
  const save = useServerFn(saveFeeHead);
  const del = useServerFn(deleteFeeHead);
  const [rows, setRows] = useState<Head[]>([]);
  const [dlg, setDlg] = useState<{ open: boolean; edit: Head | null }>({
    open: false,
    edit: null,
  });

  async function refresh() {
    try {
      setRows((await list()) as Head[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(fd: FormData) {
    const payload = {
      id: dlg.edit?.id,
      name: String(fd.get("name") ?? ""),
      code: (fd.get("code") as string) || null,
      description: (fd.get("description") as string) || null,
      isRecurring: fd.get("isRecurring") === "on",
      isActive: fd.get("isActive") !== "off",
    };
    try {
      await save({ data: payload });
      setDlg({ open: false, edit: null });
      toast.success("Saved");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setDlg({ open: true, edit: null })}>
          <Plus className="mr-2 size-4" /> New fee head
        </Button>
      </div>
      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Recurring</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.code ?? "—"}
                </TableCell>
                <TableCell>{r.isRecurring ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Badge variant={r.isActive ? "default" : "secondary"}>
                    {r.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDlg({ open: true, edit: r })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm("Delete this fee head?")) return;
                      try {
                        await del({ data: { id: r.id } });
                        refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No fee heads yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={dlg.open}
        onOpenChange={(o) => !o && setDlg({ open: false, edit: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.edit ? "Edit fee head" : "New fee head"}</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => submit(fd)}
            className="space-y-4"
          >
            <div>
              <Label>Name</Label>
              <Input name="name" required defaultValue={dlg.edit?.name} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code</Label>
                <Input name="code" defaultValue={dlg.edit?.code ?? ""} />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isRecurring"
                    defaultChecked={dlg.edit?.isRecurring}
                  />
                  Recurring
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={dlg.edit?.isActive ?? true}
                  />
                  Active
                </label>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                name="description"
                defaultValue={dlg.edit?.description ?? ""}
              />
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

/* -------------------- Structures -------------------- */
type Struct = {
  id: string;
  academicYearId: string;
  classId: string;
  feeHeadId: string;
  amount: number;
  term: string | null;
  dueDay: number | null;
  className: string | null;
  feeHeadName: string | null;
};
type Year = { id: string; name: string; isCurrent: boolean };
type Cls = { id: string; name: string; academicYearId: string };

function StructuresTab() {
  const listS = useServerFn(listFeeStructures);
  const save = useServerFn(saveFeeStructure);
  const del = useServerFn(deleteFeeStructure);
  const listH = useServerFn(listFeeHeads);
  const listY = useServerFn(listAcademicYears);
  const listC = useServerFn(listClasses);
  const generate = useServerFn(generateInvoicesFromStructure);

  const [years, setYears] = useState<Year[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [heads, setHeads] = useState<Head[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [rows, setRows] = useState<Struct[]>([]);
  const [dlg, setDlg] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [y, c, h] = await Promise.all([listY(), listC(), listH()]);
        setYears(y as Year[]);
        setClasses(c as Cls[]);
        setHeads(h as Head[]);
        const cur = (y as Year[]).find((x) => x.isCurrent) ?? (y as Year[])[0];
        if (cur) setYearId(cur.id);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!yearId) return;
    try {
      const res = (await listS({
        data: {
          academicYearId: yearId,
          classId: classId || undefined,
        },
      })) as Struct[];
      setRows(res);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId, classId]);

  const classesInYear = classes.filter((c) => c.academicYearId === yearId);

  async function submit(fd: FormData) {
    try {
      await save({
        data: {
          academicYearId: yearId,
          classId: String(fd.get("classId") ?? ""),
          feeHeadId: String(fd.get("feeHeadId") ?? ""),
          amount: Number(fd.get("amount") ?? 0),
          term: (fd.get("term") as string) || null,
          dueDay: fd.get("dueDay") ? Number(fd.get("dueDay")) : null,
        },
      });
      setDlg(false);
      toast.success("Saved");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doGenerate(fd: FormData) {
    try {
      const res = (await generate({
        data: {
          academicYearId: yearId,
          classId: String(fd.get("classId") ?? ""),
          term: (fd.get("term") as string) || null,
          issueDate: String(fd.get("issueDate") ?? today()),
          dueDate: String(fd.get("dueDate") ?? addDays(today(), 15)),
        },
      })) as { created: number; message?: string };
      toast.success(
        res.message ?? `Generated ${res.created} invoice${res.created === 1 ? "" : "s"}`,
      );
      setGenOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={yearId} onValueChange={setYearId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Academic year" />
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
        <Select
          value={classId || "__all__"}
          onValueChange={(v) => setClassId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All classes</SelectItem>
            {classesInYear.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)} disabled={!yearId}>
            <Receipt className="mr-2 size-4" /> Generate invoices
          </Button>
          <Button onClick={() => setDlg(true)} disabled={!yearId}>
            <Plus className="mr-2 size-4" /> Add
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Fee head</TableHead>
              <TableHead>Term</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.className}</TableCell>
                <TableCell>{r.feeHeadName}</TableCell>
                <TableCell>{r.term ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(r.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm("Delete?")) return;
                      try {
                        await del({ data: { id: r.id } });
                        refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No fee structure defined yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New fee structure</DialogTitle>
          </DialogHeader>
          <form action={(fd) => submit(fd)} className="space-y-4">
            <div>
              <Label>Class</Label>
              <select
                name="classId"
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {classesInYear.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Fee head</Label>
              <select
                name="feeHeadId"
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {heads
                  .filter((h) => h.isActive)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Amount (₹)</Label>
                <Input name="amount" type="number" min={0} required />
              </div>
              <div>
                <Label>Term</Label>
                <Input name="term" placeholder="Q1 / Annual / Monthly" />
              </div>
              <div>
                <Label>Due day</Label>
                <Input name="dueDay" type="number" min={1} max={31} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate invoices</DialogTitle>
          </DialogHeader>
          <form action={(fd) => doGenerate(fd)} className="space-y-4">
            <div>
              <Label>Class</Label>
              <select
                name="classId"
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {classesInYear.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Term (optional)</Label>
              <Input name="term" placeholder="Leave blank for all terms" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Issue date</Label>
                <Input name="issueDate" type="date" defaultValue={today()} />
              </div>
              <div>
                <Label>Due date</Label>
                <Input
                  name="dueDate"
                  type="date"
                  defaultValue={addDays(today(), 15)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Generate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Invoices -------------------- */
type Invoice = {
  id: string;
  invoiceNo: string;
  studentId: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  studentFirst: string | null;
  studentLast: string | null;
  admissionNo: string | null;
};

function InvoicesTab() {
  const listI = useServerFn(listInvoices);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<string>("__all__");
  const [detail, setDetail] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  async function refresh() {
    try {
      const res = (await listI({
        data: {
          status: status === "__all__" ? undefined : (status as any),
        },
      })) as { rows: Invoice[]; total: number };
      setRows(res.rows);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const statusBadge = (s: Invoice["status"]) => {
    const map: Record<string, string> = {
      unpaid: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      partial: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
      paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      cancelled: "bg-muted text-muted-foreground",
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[s]}`}>
        {s}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 size-4" /> New invoice
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                <TableCell>
                  <div className="font-medium">
                    {r.studentFirst} {r.studentLast}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.admissionNo}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.issueDate}</TableCell>
                <TableCell className="text-sm">{r.dueDate}</TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(r.totalAmount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(r.paidAmount)}
                </TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setDetail(r.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  No invoices.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {detail && (
        <InvoiceDialog
          id={detail}
          onClose={() => {
            setDetail(null);
            refresh();
          }}
        />
      )}
      {newOpen && (
        <NewInvoiceDialog
          onClose={(created) => {
            setNewOpen(false);
            if (created) refresh();
          }}
        />
      )}
    </div>
  );
}

function NewInvoiceDialog({ onClose }: { onClose: (created: boolean) => void }) {
  const listStu = useServerFn(listStudents);
  const listH = useServerFn(listFeeHeads);
  const create = useServerFn(createInvoice);
  const [students, setStudents] = useState<
    { id: string; firstName: string; lastName: string | null; admissionNo: string }[]
  >([]);
  const [heads, setHeads] = useState<Head[]>([]);
  const [items, setItems] = useState<
    { feeHeadId: string; description: string; amount: number }[]
  >([{ feeHeadId: "", description: "", amount: 0 }]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.all([
          listH(),
          listStu({ data: { query: q, page: 1, pageSize: 25 } }),
        ]);
        setHeads(h as Head[]);
        setStudents(
          (s as any).rows.map((x: any) => ({
            id: x.id,
            firstName: x.firstName,
            lastName: x.lastName,
            admissionNo: x.admissionNo,
          })),
        );
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  async function submit(fd: FormData) {
    const studentId = String(fd.get("studentId") ?? "");
    if (!studentId) return toast.error("Select a student");
    if (items.length === 0 || items.every((i) => !i.description))
      return toast.error("Add at least one item");
    try {
      await create({
        data: {
          studentId,
          issueDate: String(fd.get("issueDate") ?? today()),
          dueDate: String(fd.get("dueDate") ?? addDays(today(), 15)),
          notes: (fd.get("notes") as string) || null,
          items: items
            .filter((i) => i.description && i.amount >= 0)
            .map((i) => ({
              feeHeadId: i.feeHeadId || null,
              description: i.description,
              amount: Number(i.amount),
            })),
        },
      });
      toast.success("Invoice created");
      onClose(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
        </DialogHeader>
        <form action={(fd) => submit(fd)} className="space-y-4">
          <div>
            <Label>Student</Label>
            <Input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              name="studentId"
              required
              className="mt-2 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName ?? ""} — {s.admissionNo}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Issue date</Label>
              <Input name="issueDate" type="date" defaultValue={today()} />
            </div>
            <div>
              <Label>Due date</Label>
              <Input
                name="dueDate"
                type="date"
                defaultValue={addDays(today(), 15)}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Line items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { feeHeadId: "", description: "", amount: 0 },
                  ])
                }
              >
                <Plus className="mr-1 size-3" /> Row
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr_120px_auto] gap-2 items-center">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={it.feeHeadId}
                    onChange={(e) => {
                      const v = e.target.value;
                      const head = heads.find((h) => h.id === v);
                      setItems((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? {
                                ...x,
                                feeHeadId: v,
                                description: x.description || head?.name || "",
                              }
                            : x,
                        ),
                      );
                    }}
                  >
                    <option value="">Fee head…</option>
                    {heads.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, idx) =>
                          idx === i ? { ...x, description: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    value={it.amount}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, idx) =>
                          idx === i
                            ? { ...x, amount: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setItems((p) => p.filter((_, idx) => idx !== i))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end text-sm">
              <span className="text-muted-foreground mr-2">Total:</span>
              <span className="font-mono font-semibold">{fmt(total)}</span>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit">Create invoice</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(getInvoice);
  const pay = useServerFn(recordPayment);
  const cancel = useServerFn(cancelInvoice);
  const listAH = useServerFn(listAccountHeads);
  const [data, setData] = useState<any>(null);
  const [heads, setHeads] = useState<{ id: string; name: string; kind: string }[]>(
    [],
  );

  async function refresh() {
    try {
      const d = await get({ data: { id } });
      setData(d);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    listAH()
      .then((h) => setHeads(h as any))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return null;
  const inv = data.invoice;
  const remaining = inv.totalAmount - inv.paidAmount;

  async function submitPayment(fd: FormData) {
    try {
      await pay({
        data: {
          invoiceId: inv.id,
          amount: Number(fd.get("amount") ?? 0),
          method: (fd.get("method") as any) || "cash",
          reference: (fd.get("reference") as string) || null,
          paidOn: String(fd.get("paidOn") ?? today()),
          remarks: (fd.get("remarks") as string) || null,
          postToAccountHeadId: (fd.get("postToAccountHeadId") as string) || null,
        },
      });
      toast.success("Payment recorded");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Invoice {inv.invoiceNo}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {data.student?.firstName} {data.student?.lastName} · {data.student?.admissionNo}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3 rounded-md bg-surface-muted p-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Issued</div>
            <div className="font-medium">{inv.issueDate}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Due</div>
            <div className="font-medium">{inv.dueDate}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-mono font-semibold">{fmt(inv.totalAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className="font-mono font-semibold text-primary">
              {fmt(remaining)}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {fmt(it.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold">Payments</div>
          {data.payments.length === 0 ? (
            <div className="text-xs text-muted-foreground">No payments yet.</div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.paidOn}</TableCell>
                      <TableCell className="capitalize">{p.method}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(p.amount)}
                      </TableCell>
                      <TableCell>
                        {p.isCancelled ? (
                          <span className="text-xs text-muted-foreground">
                            cancelled
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600">ok</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {inv.status !== "cancelled" && remaining > 0 && (
          <form
            action={(fd) => submitPayment(fd)}
            className="rounded-md border border-border p-3 space-y-3"
          >
            <div className="text-sm font-semibold">Record payment</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Amount</Label>
                <Input
                  name="amount"
                  type="number"
                  min={1}
                  max={remaining}
                  defaultValue={remaining}
                  required
                />
              </div>
              <div>
                <Label>Method</Label>
                <select
                  name="method"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="cash"
                >
                  {["cash", "bank", "upi", "card", "cheque", "online", "other"].map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <Label>Paid on</Label>
                <Input name="paidOn" type="date" defaultValue={today()} />
              </div>
              <div>
                <Label>Reference</Label>
                <Input name="reference" />
              </div>
              <div className="col-span-2">
                <Label>Post to account (optional)</Label>
                <select
                  name="postToAccountHeadId"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {heads
                    .filter((h) => h.kind === "income")
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Input name="remarks" />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save payment</Button>
            </div>
          </form>
        )}

        <DialogFooter className="justify-between">
          <div>
            {inv.status !== "cancelled" && (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!confirm("Cancel this invoice?")) return;
                  try {
                    await cancel({ data: { id: inv.id } });
                    toast.success("Invoice cancelled");
                    refresh();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Ban className="mr-2 size-4" /> Cancel invoice
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 size-4" /> Print
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Due report -------------------- */
function DueTab() {
  const run = useServerFn(dueReport);
  const listC = useServerFn(listClasses);
  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [classId, setClassId] = useState<string>("");

  useEffect(() => {
    listC()
      .then((c) => setClasses(c as Cls[]))
      .catch(() => {});
  }, [listC]);
  useEffect(() => {
    (async () => {
      try {
        const res = await run({
          data: { classId: classId || undefined },
        });
        setRows(res as any);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [run, classId]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (r.totalDue || 0), 0),
    [rows],
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Select
          value={classId || "__all__"}
          onValueChange={(v) => setClassId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm">
          <span className="text-muted-foreground mr-2">Outstanding:</span>
          <span className="font-mono font-semibold text-primary">
            {fmt(total)}
          </span>
        </div>
      </div>
      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-mono text-xs">
                  {r.admissionNo}
                </TableCell>
                <TableCell>
                  {r.first} {r.last}
                </TableCell>
                <TableCell className="text-right">{r.invoices}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary">
                  {fmt(r.totalDue)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  No dues 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
