import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getSystemHealth,
  listSystemLogs,
  clearCache,
  runIntegrityCheck,
  writeTestLog,
} from "@/lib/devops.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Activity,
  Database,
  Clock,
  Users,
  GraduationCap,
  FileText,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/app/devops")({
  component: DevOpsPage,
});

type Health = Awaited<ReturnType<typeof getSystemHealth>>;
type LogRow = Awaited<ReturnType<typeof listSystemLogs>>[number];

type IntegrityCheck = { name: string; ok: boolean; detail: string };

function isResponseLike(value: unknown): value is Response {
  return value instanceof Response;
}

function isHealthPayload(value: unknown): value is Health {
  return !!value && typeof value === "object" && "db" in value && "counts" in value && "server" in value;
}

function normalizeLogRows(value: unknown): LogRow[] {
  if (Array.isArray(value)) return value as LogRow[];
  if (value && typeof value === "object" && "rows" in value && Array.isArray((value as { rows?: unknown }).rows)) {
    return (value as { rows: LogRow[] }).rows;
  }
  return [];
}

function normalizeIntegrityChecks(value: unknown): IntegrityCheck[] {
  if (value && typeof value === "object" && "checks" in value && Array.isArray((value as { checks?: unknown }).checks)) {
    return (value as { checks: IntegrityCheck[] }).checks;
  }
  return [];
}

function DevOpsPage() {
  const health = useServerFn(getSystemHealth);
  const logs = useServerFn(listSystemLogs);
  const clear = useServerFn(clearCache);
  const integrity = useServerFn(runIntegrityCheck);
  const writeTest = useServerFn(writeTestLog);

  const [h, setH] = useState<Health | null>(null);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [sinceHours, setSinceHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<
    { name: string; ok: boolean; detail: string }[] | null
  >(null);

  async function refreshHealth() {
    try {
      const result = await health();
      if (isResponseLike(result)) {
        throw new Error(result.statusText || "Unable to load system health");
      }
      if (!isHealthPayload(result)) {
        setH(null);
        return;
      }
      setH(result);
    } catch (e) {
      setH(null);
      toast.error((e as Error).message);
    }
  }

  async function refreshLogs() {
    try {
      const result = await logs({
        data: { level, sinceHours, limit: 200 },
      });
      if (isResponseLike(result)) {
        throw new Error(result.statusText || "Unable to load log entries");
      }
      setRows(normalizeLogRows(result));
    } catch (e) {
      setRows([]);
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    refreshHealth();
    refreshLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    refreshLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, sinceHours]);

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Developer Utilities"
        description="System health, activity logs, database integrity, and maintenance tools."
        action={
          <Button variant="outline" size="sm" onClick={refreshHealth}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Health overview */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Database className="w-4 h-4" />}
            label="Database"
            value={h ? (h.db.ok ? "Healthy" : "Down") : "…"}
            hint={h ? `${h.db.latencyMs} ms` : ""}
            tone={h?.db.ok ? "good" : "bad"}
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Uptime"
            value={h ? formatUptime(h.server.uptimeSec) : "…"}
            hint={h ? h.server.env : ""}
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Users"
            value={h ? String(h.counts.users) : "…"}
            hint="Platform-wide"
          />
          <StatCard
            icon={<GraduationCap className="w-4 h-4" />}
            label="Students"
            value={h ? String(h.counts.students) : "…"}
            hint="Current tenant"
          />
        </div>

        {h && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <MiniStat label="Teachers" value={h.counts.teachers} />
            <MiniStat label="Employees" value={h.counts.employees} />
            <MiniStat label="Exams" value={h.counts.exams} />
            <MiniStat label="Invoices" value={h.counts.invoices} />
            <MiniStat label="Log entries" value={h.counts.logs} />
          </div>
        )}
      </section>

      {/* Maintenance actions */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Maintenance</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <ActionCard
            icon={<Trash2 className="w-4 h-4" />}
            title="Clear cache"
            description="Purge in-memory caches for lookups and permissions."
            actionLabel="Clear now"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await clear();
                if (isResponseLike(r)) {
                  throw new Error(r.statusText || "Unable to clear cache");
                }
                if (!r || typeof r !== "object" || !("clearedAt" in r)) {
                  throw new Error("Unexpected cache clear response");
                }
                toast.success(
                  `Cache cleared at ${new Date((r as { clearedAt: string }).clearedAt).toLocaleTimeString()}`,
                );
                await refreshLogs();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />

          <ActionCard
            icon={<ShieldCheck className="w-4 h-4" />}
            title="DB integrity check"
            description="Scan for orphaned rows across key relationships."
            actionLabel="Run check"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await integrity();
                if (isResponseLike(r)) {
                  throw new Error(r.statusText || "Unable to run integrity check");
                }
                const checks = normalizeIntegrityChecks(r);
                setIntegrityResult(checks);
                const bad = checks.filter((c) => !c.ok).length;
                if (bad === 0) toast.success("All checks passed");
                else toast.warning(`${bad} check(s) reported issues`);
                await refreshLogs();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />

          <ActionCard
            icon={<FileText className="w-4 h-4" />}
            title="Write test log"
            description="Emit a test entry to verify the log pipeline."
            actionLabel="Write log"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await writeTest({
                  data: { level: "info", message: "Manual test log entry" },
                });
                toast.success("Test log written");
                await refreshLogs();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>

        {integrityResult && (
          <Card className="mt-4 p-5">
            <div className="text-sm font-medium mb-3">Integrity results</div>
            <div className="space-y-2">
              {integrityResult.map((c) => (
                <div
                  key={c.name}
                  className="flex justify-between items-center text-sm border-b pb-2 last:border-0"
                >
                  <span>{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{c.detail}</span>
                    <Badge variant={c.ok ? "secondary" : "destructive"}>
                      {c.ok ? "OK" : "Issue"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Log viewer */}
      <section>
        <div className="flex items-end justify-between mb-3 flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activity logs
            </h2>
            <p className="text-sm text-muted-foreground">
              Recent system events, scoped to your tenant.
            </p>
          </div>
          <div className="flex gap-3 items-end">
            <div>
              <Label className="text-xs">Level</Label>
              <Select
                value={level}
                onValueChange={(v) =>
                  setLevel(v as "all" | "info" | "warn" | "error")
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Since (hrs)</Label>
              <Input
                type="number"
                className="w-24"
                value={sinceHours}
                min={1}
                max={720}
                onChange={(e) => setSinceHours(Number(e.target.value) || 24)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={refreshLogs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Time</TableHead>
                <TableHead className="w-20">Level</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    No log entries in the selected window.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.level === "error"
                          ? "destructive"
                          : r.level === "warn"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {r.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.category}</TableCell>
                  <TableCell className="text-sm">
                    {r.message}
                    {r.metadata && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          metadata
                        </summary>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                          {r.metadata}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          tone === "bad"
            ? "text-destructive"
            : tone === "good"
              ? "text-primary"
              : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-3 bg-background">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  actionLabel,
  onClick,
  busy,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void | Promise<void>;
  busy: boolean;
}) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1 flex-1">
        {description}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 self-start"
        disabled={busy}
        onClick={onClick}
      >
        {actionLabel}
      </Button>
    </Card>
  );
}

function formatUptime(sec: number) {
  if (sec <= 0) return "n/a";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}
