import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listEmployees,
  saveEmployee,
  deleteEmployee,
  listLeaveTypes,
  saveLeaveType,
  deleteLeaveType,
  listLeaveRequests,
  saveLeaveRequest,
  decideLeaveRequest,
  deleteLeaveRequest,
  listPolicies,
  savePolicy,
  deletePolicy,
  listWorkOutside,
  saveWorkOutside,
  deleteWorkOutside,
} from "@/lib/hrm.functions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { confirmDelete } from "@/lib/confirm";

export const Route = createFileRoute("/app/hrm")({ component: HrmPage });

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  designation: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

type LeaveType = {
  id: string;
  name: string;
  code: string | null;
  annualQuota: number;
  isPaid: boolean;
  isActive: boolean;
};

type LeaveRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string | null;
  leaveTypeId: string | null;
  leaveTypeName: string | null;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decisionNote: string | null;
};

type Policy = {
  id: string;
  title: string;
  body: string;
  effectiveFrom: string | null;
  isActive: boolean;
};

type WorkLog = {
  id: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string | null;
  logDate: string;
  location: string | null;
  purpose: string;
  hours: number | null;
  note: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function HrmPage() {
  const [tab, setTab] = useState<
    "employees" | "leave" | "policies" | "outside"
  >("employees");
  return (
    <div className="p-8">
      <PageHeader
        title="Human Resources"
        description="Employees, leave requests, HR policies, and off-site work logs."
      />
      <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-border bg-surface-muted p-1 text-sm w-fit">
        {(
          [
            ["employees", "Employees"],
            ["leave", "Leave"],
            ["policies", "HR Policies"],
            ["outside", "Work Outside"],
          ] as ["employees" | "leave" | "policies" | "outside", string][]
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
      {tab === "employees" ? <EmployeesTab /> : null}
      {tab === "leave" ? <LeaveTab /> : null}
      {tab === "policies" ? <PoliciesTab /> : null}
      {tab === "outside" ? <OutsideTab /> : null}
    </div>
  );
}

/* ============ EMPLOYEES ============ */
function EmployeesTab() {
  const listFn = useServerFn(listEmployees);
  const saveFn = useServerFn(saveEmployee);
  const delFn = useServerFn(deleteEmployee);
  const [rows, setRows] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Employee> | null>(null);

  async function reload() {
    try {
      const data = await listFn({ data: { q: q || undefined } });
      setRows(data as Employee[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(form: FormData) {
    const payload = {
      id: edit?.id,
      employeeCode: String(form.get("employeeCode") || ""),
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || "") || null,
      designation: String(form.get("designation") || "") || null,
      department: String(form.get("department") || "") || null,
      phone: String(form.get("phone") || "") || null,
      email: String(form.get("email") || "") || null,
      joinedOn: String(form.get("joinedOn") || "") || null,
      isActive: form.get("isActive") === "on",
    };
    try {
      await saveFn({ data: payload });
      toast.success("Employee saved");
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function del(id: string) {
    if (!confirm("Delete this employee? This removes payroll history.")) return;
    try {
      await delFn({ data: { id } });
      toast.success("Deleted");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search name / code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reload()}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={reload}>
          Search
        </Button>
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEdit({ isActive: true });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> New Employee
        </Button>
      </div>

      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No employees yet.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  {r.employeeCode}
                </TableCell>
                <TableCell className="font-medium">
                  {r.firstName} {r.lastName ?? ""}
                </TableCell>
                <TableCell>{r.designation ?? "—"}</TableCell>
                <TableCell>{r.department ?? "—"}</TableCell>
                <TableCell>{r.phone ?? "—"}</TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      r.isActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.isActive ? "Active" : "Inactive"}
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
                      onClick={() => del(r.id)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit Employee" : "New Employee"}</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submit(fd);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Employee code</Label>
                <Input
                  name="employeeCode"
                  defaultValue={edit?.employeeCode ?? ""}
                  required
                />
              </div>
              <div>
                <Label>First name</Label>
                <Input
                  name="firstName"
                  defaultValue={edit?.firstName ?? ""}
                  required
                />
              </div>
              <div>
                <Label>Last name</Label>
                <Input name="lastName" defaultValue={edit?.lastName ?? ""} />
              </div>
              <div>
                <Label>Designation</Label>
                <Input
                  name="designation"
                  defaultValue={edit?.designation ?? ""}
                />
              </div>
              <div>
                <Label>Department</Label>
                <Input name="department" defaultValue={edit?.department ?? ""} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input name="phone" defaultValue={edit?.phone ?? ""} />
              </div>
              <div className="col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  name="email"
                  defaultValue={edit?.email ?? ""}
                />
              </div>
              <div>
                <Label>Joined on</Label>
                <Input type="date" name="joinedOn" />
              </div>
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

/* ============ LEAVE ============ */
function LeaveTab() {
  const listReqFn = useServerFn(listLeaveRequests);
  const saveReqFn = useServerFn(saveLeaveRequest);
  const decideFn = useServerFn(decideLeaveRequest);
  const delReqFn = useServerFn(deleteLeaveRequest);
  const listTypeFn = useServerFn(listLeaveTypes);
  const saveTypeFn = useServerFn(saveLeaveType);
  const delTypeFn = useServerFn(deleteLeaveType);
  const listEmpFn = useServerFn(listEmployees);
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openReq, setOpenReq] = useState(false);
  const [openType, setOpenType] = useState(false);
  const [editType, setEditType] = useState<Partial<LeaveType> | null>(null);

  async function reload() {
    try {
      const [r, t, e] = await Promise.all([
        listReqFn({ data: {} }),
        listTypeFn(),
        listEmpFn({ data: { activeOnly: true } }),
      ]);
      setRequests(r as LeaveRequestRow[]);
      setTypes(t as LeaveType[]);
      setEmployees(e as Employee[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitReq(fd: FormData) {
    try {
      await saveReqFn({
        data: {
          employeeId: String(fd.get("employeeId")),
          leaveTypeId: String(fd.get("leaveTypeId") || "") || null,
          fromDate: String(fd.get("fromDate")),
          toDate: String(fd.get("toDate")),
          days: Number(fd.get("days")),
          reason: String(fd.get("reason") || "") || null,
        },
      });
      toast.success("Request submitted");
      setOpenReq(false);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function submitType(fd: FormData) {
    try {
      await saveTypeFn({
        data: {
          id: editType?.id,
          name: String(fd.get("name")),
          code: String(fd.get("code") || "") || null,
          annualQuota: Number(fd.get("annualQuota") || 0),
          isPaid: fd.get("isPaid") === "on",
          isActive: fd.get("isActive") === "on",
        },
      });
      toast.success("Leave type saved");
      setOpenType(false);
      setEditType(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Leave Requests</h2>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setOpenReq(true)}>
            <Plus className="mr-1 size-4" /> New Request
          </Button>
        </div>
        <div className="rounded-md border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No leave requests.
                  </TableCell>
                </TableRow>
              ) : null}
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.employeeName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.employeeCode}
                    </div>
                  </TableCell>
                  <TableCell>{r.leaveTypeName ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.fromDate} → {r.toDate}
                  </TableCell>
                  <TableCell>{r.days}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status === "pending" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Approve"
                            onClick={async () => {
                              try {
                                await decideFn({
                                  data: { id: r.id, status: "approved" },
                                });
                                toast.success("Approved");
                                reload();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Check className="size-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reject"
                            onClick={async () => {
                              try {
                                await decideFn({
                                  data: { id: r.id, status: "rejected" },
                                });
                                toast.success("Rejected");
                                reload();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <X className="size-4 text-rose-600" />
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Delete this request?")) return;
                          try {
                            await delReqFn({ data: { id: r.id } });
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
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Leave Types</h2>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditType({ isActive: true, isPaid: true, annualQuota: 12 });
              setOpenType(true);
            }}
          >
            <Plus className="mr-1 size-4" /> Add
          </Button>
        </div>
        <div className="rounded-md border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    No leave types.
                  </TableCell>
                </TableRow>
              ) : null}
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {t.name}
                    {t.code ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({t.code})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{t.annualQuota}</TableCell>
                  <TableCell>{t.isPaid ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditType(t);
                          setOpenType(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirmDelete("HR record")) return;
                          try {
                            await delTypeFn({ data: { id: t.id } });
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
      </div>

      <Dialog open={openReq} onOpenChange={setOpenReq}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Leave Request</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submitReq(fd);
            }}
            className="space-y-3"
          >
            <div>
              <Label>Employee</Label>
              <select
                name="employeeId"
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
              <Label>Leave type</Label>
              <select
                name="leaveTypeId"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">(unspecified)</option>
                {types
                  .filter((t) => t.isActive)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>From</Label>
                <Input
                  type="date"
                  name="fromDate"
                  defaultValue={today()}
                  required
                />
              </div>
              <div>
                <Label>To</Label>
                <Input
                  type="date"
                  name="toDate"
                  defaultValue={today()}
                  required
                />
              </div>
              <div>
                <Label>Days</Label>
                <Input
                  type="number"
                  name="days"
                  min={1}
                  defaultValue={1}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea name="reason" rows={3} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenReq(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openType} onOpenChange={setOpenType}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editType?.id ? "Edit Leave Type" : "New Leave Type"}
            </DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submitType(fd);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input name="name" defaultValue={editType?.name ?? ""} required />
              </div>
              <div>
                <Label>Code</Label>
                <Input name="code" defaultValue={editType?.code ?? ""} />
              </div>
              <div>
                <Label>Annual quota (days)</Label>
                <Input
                  type="number"
                  name="annualQuota"
                  min={0}
                  defaultValue={editType?.annualQuota ?? 12}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isPaid"
                  defaultChecked={editType?.isPaid ?? true}
                />
                Paid leave
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editType?.isActive ?? true}
                />
                Active
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenType(false)}
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

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "rejected"
      ? "bg-rose-500/10 text-rose-600"
      : status === "cancelled"
      ? "bg-muted text-muted-foreground"
      : "bg-amber-500/10 text-amber-600";
  return (
    <span className={`rounded px-2 py-0.5 text-xs capitalize ${cls}`}>
      {status}
    </span>
  );
}

/* ============ POLICIES ============ */
function PoliciesTab() {
  const listFn = useServerFn(listPolicies);
  const saveFn = useServerFn(savePolicy);
  const delFn = useServerFn(deletePolicy);
  const [rows, setRows] = useState<Policy[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Policy> | null>(null);

  async function reload() {
    try {
      setRows((await listFn()) as Policy[]);
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
          title: String(fd.get("title")),
          body: String(fd.get("body")),
          effectiveFrom: String(fd.get("effectiveFrom") || "") || null,
          isActive: fd.get("isActive") === "on",
        },
      });
      toast.success("Policy saved");
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
            setEdit({ isActive: true });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> New Policy
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 ? (
          <div className="col-span-2 rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No policies yet.
          </div>
        ) : null}
        {rows.map((p) => (
          <div
            key={p.id}
            className="rounded-md border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold">
                  {p.title}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {p.effectiveFrom
                    ? `Effective ${p.effectiveFrom}`
                    : "No effective date"}
                  {" · "}
                  {p.isActive ? "Active" : "Inactive"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEdit(p);
                    setOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("Delete this policy?")) return;
                    try {
                      await delFn({ data: { id: p.id } });
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
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {p.body}
            </p>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit Policy" : "New Policy"}</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              void submit(fd);
            }}
            className="space-y-3"
          >
            <div>
              <Label>Title</Label>
              <Input name="title" defaultValue={edit?.title ?? ""} required />
            </div>
            <div>
              <Label>Effective from</Label>
              <Input
                type="date"
                name="effectiveFrom"
                defaultValue={edit?.effectiveFrom ?? ""}
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                name="body"
                rows={10}
                defaultValue={edit?.body ?? ""}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={edit?.isActive ?? true}
              />
              Active
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

/* ============ WORK OUTSIDE ============ */
function OutsideTab() {
  const listFn = useServerFn(listWorkOutside);
  const saveFn = useServerFn(saveWorkOutside);
  const delFn = useServerFn(deleteWorkOutside);
  const listEmpFn = useServerFn(listEmployees);
  const [rows, setRows] = useState<WorkLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);

  async function reload() {
    try {
      const [r, e] = await Promise.all([
        listFn({ data: {} }),
        listEmpFn({ data: { activeOnly: true } }),
      ]);
      setRows(r as WorkLog[]);
      setEmployees(e as Employee[]);
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
          employeeId: String(fd.get("employeeId")),
          logDate: String(fd.get("logDate")),
          location: String(fd.get("location") || "") || null,
          purpose: String(fd.get("purpose")),
          hours: fd.get("hours") ? Number(fd.get("hours")) : null,
          note: String(fd.get("note") || "") || null,
        },
      });
      toast.success("Log added");
      setOpen(false);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex">
        <div className="flex-1" />
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> New Log
        </Button>
      </div>
      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No off-site work logs.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.logDate}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.employeeName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.employeeCode}
                  </div>
                </TableCell>
                <TableCell>{r.location ?? "—"}</TableCell>
                <TableCell>{r.purpose}</TableCell>
                <TableCell>{r.hours ?? "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirmDelete("HR record")) return;
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Off-Site Work Log</DialogTitle>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  name="logDate"
                  defaultValue={today()}
                  required
                />
              </div>
              <div>
                <Label>Hours</Label>
                <Input type="number" name="hours" min={0} max={24} />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input name="location" />
            </div>
            <div>
              <Label>Purpose</Label>
              <Input name="purpose" required />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea name="note" rows={3} />
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
