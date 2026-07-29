import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccountHeads,
  saveAccountHead,
  deleteAccountHead,
  saveTransaction,
  deleteTransaction,
  ledger,
} from "@/lib/accounts.functions";
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
import { Plus, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { confirmDelete } from "@/lib/confirm";

export const Route = createFileRoute("/app/accounts")({ component: AccountsPage });

type Head = {
  id: string;
  name: string;
  kind: "income" | "expense";
  description: string | null;
  isActive: boolean;
};

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function AccountsPage() {
  const [tab, setTab] = useState<"ledger" | "heads">("ledger");
  return (
    <div className="p-8">
      <PageHeader
        title="Accounts"
        description="Income & expense heads, transactions, and ledger."
      />
      <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-border bg-surface-muted p-1 text-sm w-fit">
        {(
          [
            ["ledger", "Ledger"],
            ["heads", "Account Heads"],
          ] as ["ledger" | "heads", string][]
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

      {tab === "ledger" && <LedgerTab />}
      {tab === "heads" && <HeadsTab />}
    </div>
  );
}

function HeadsTab() {
  const list = useServerFn(listAccountHeads);
  const save = useServerFn(saveAccountHead);
  const del = useServerFn(deleteAccountHead);
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
    try {
      await save({
        data: {
          id: dlg.edit?.id,
          name: String(fd.get("name") ?? ""),
          kind: fd.get("kind") as "income" | "expense",
          description: (fd.get("description") as string) || null,
          isActive: fd.get("isActive") !== "off",
        },
      });
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
          <Plus className="mr-2 size-4" /> New head
        </Button>
      </div>
      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Description</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                      r.kind === "income"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-500/15 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {r.kind === "income" ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUp className="size-3" />
                    )}
                    {r.kind}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.description ?? "—"}
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
                      if (!confirmDelete("account entry")) return;
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
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  No account heads.
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
            <DialogTitle>
              {dlg.edit ? "Edit account head" : "New account head"}
            </DialogTitle>
          </DialogHeader>
          <form action={(fd) => submit(fd)} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input name="name" required defaultValue={dlg.edit?.name} />
            </div>
            <div>
              <Label>Kind</Label>
              <select
                name="kind"
                required
                defaultValue={dlg.edit?.kind ?? "income"}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                name="description"
                defaultValue={dlg.edit?.description ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={dlg.edit?.isActive ?? true}
              />
              Active
            </label>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Tx = {
  id: string;
  txDate: string;
  kind: "income" | "expense";
  amount: number;
  description: string | null;
  reference: string | null;
  accountHeadId: string;
  headName: string | null;
};

function LedgerTab() {
  const run = useServerFn(ledger);
  const listH = useServerFn(listAccountHeads);
  const save = useServerFn(saveTransaction);
  const del = useServerFn(deleteTransaction);
  const [heads, setHeads] = useState<Head[]>([]);
  const [rows, setRows] = useState<Tx[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, net: 0 });
  const [headId, setHeadId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [dlg, setDlg] = useState(false);

  useEffect(() => {
    listH()
      .then((h) => setHeads(h as Head[]))
      .catch((e) => toast.error((e as Error).message));
  }, [listH]);

  async function refresh() {
    try {
      const res: any = await run({
        data: {
          accountHeadId: headId || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setRows(res.rows);
      setTotals(res.totals);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headId, from, to]);

  async function submit(fd: FormData) {
    try {
      const headIdVal = String(fd.get("accountHeadId") ?? "");
      const head = heads.find((h) => h.id === headIdVal);
      if (!head) { toast.error("Choose an account head"); return; }
      await save({
        data: {
          accountHeadId: headIdVal,
          kind: head.kind,
          txDate: String(fd.get("txDate") ?? today()),
          amount: Number(fd.get("amount") ?? 0),
          description: (fd.get("description") as string) || null,
          reference: (fd.get("reference") as string) || null,
        },
      });
      setDlg(false);
      toast.success("Saved");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">Income</div>
          <div className="mt-1 font-mono text-xl font-semibold text-emerald-600">
            {fmt(totals.income)}
          </div>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">Expense</div>
          <div className="mt-1 font-mono text-xl font-semibold text-red-600">
            {fmt(totals.expense)}
          </div>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">Net</div>
          <div className="mt-1 font-mono text-xl font-semibold text-primary">
            {fmt(totals.net)}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={headId || "__all__"}
          onValueChange={(v) => setHeadId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Account head" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All heads</SelectItem>
            {heads.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name} · {h.kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-[160px]"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-[160px]"
        />
        <div className="ml-auto">
          <Button onClick={() => setDlg(true)}>
            <Plus className="mr-2 size-4" /> New transaction
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Head</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{r.txDate}</TableCell>
                <TableCell>{r.headName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.description ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.reference ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-600">
                  {r.kind === "income" ? fmt(r.amount) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {r.kind === "expense" ? fmt(r.amount) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirmDelete("account entry")) return;
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No transactions.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New transaction</DialogTitle>
          </DialogHeader>
          <form action={(fd) => submit(fd)} className="space-y-4">
            <div>
              <Label>Account head</Label>
              <select
                name="accountHeadId"
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {heads
                  .filter((h) => h.isActive)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} · {h.kind}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input name="txDate" type="date" defaultValue={today()} required />
              </div>
              <div>
                <Label>Amount</Label>
                <Input name="amount" type="number" min={1} required />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input name="description" />
            </div>
            <div>
              <Label>Reference</Label>
              <Input name="reference" />
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
