import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listEvents,
  saveEvent,
  deleteEvent,
} from "@/lib/calendar.functions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Printer } from "lucide-react";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

type Event = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  type: "holiday" | "exam" | "event" | "meeting" | "other";
  color: string | null;
  location: string | null;
};

const typeColors: Record<Event["type"], string> = {
  holiday: "bg-rose-500/15 text-rose-600 border-rose-500/20",
  exam: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  event: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  meeting: "bg-sky-500/15 text-sky-600 border-sky-500/20",
  other: "bg-zinc-500/15 text-zinc-600 border-zinc-500/20",
};

function CalendarPage() {
  const listFn = useServerFn(listEvents);
  const saveFn = useServerFn(saveEvent);
  const delFn = useServerFn(deleteEvent);

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rows, setRows] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Event> | null>(null);

  const monthLabel = cursor.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  async function refresh() {
    const r = await listFn({ data: { from, to } });
    setRows(r as Event[]);
  }
  useEffect(() => {
    refresh();
  }, [from, to]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  function eventsOn(date: Date) {
    const s = date.toISOString().slice(0, 10);
    return rows.filter((r) => s >= r.startDate && s <= r.endDate);
  }

  async function submit() {
    if (!edit?.title || !edit?.startDate || !edit?.endDate)
      return toast.error("Title, start and end required");
    try {
      await saveFn({
        data: {
          id: edit.id,
          title: edit.title!,
          description: edit.description ?? null,
          startDate: edit.startDate!,
          endDate: edit.endDate!,
          isAllDay: edit.isAllDay ?? true,
          type: (edit.type as Event["type"]) ?? "event",
          color: edit.color ?? null,
          location: edit.location ?? null,
        },
      });
      toast.success("Saved");
      setOpen(false);
      setEdit(null);
      refresh();
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Academic Calendar"
        description="Holidays, exams, events, and meetings"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setEdit({
                  type: "event",
                  isAllDay: true,
                  startDate: today,
                  endDate: today,
                });
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New event
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border rounded-lg p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setCursor(
              new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
            )
          }
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="font-semibold text-lg">{monthLabel}</div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setCursor(
              new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
            )
          }
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs uppercase tracking-wider">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2 text-center font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            const events = cell ? eventsOn(cell) : [];
            const isToday =
              cell && cell.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={`min-h-[110px] border-r border-b p-1.5 ${
                  !cell ? "bg-muted/20" : ""
                }`}
              >
                {cell && (
                  <>
                    <div
                      className={`text-xs font-medium mb-1 ${
                        isToday
                          ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"
                          : ""
                      }`}
                    >
                      {cell.getDate()}
                    </div>
                    <div className="space-y-1">
                      {events.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          className={`w-full text-left text-[11px] px-1.5 py-0.5 rounded border truncate ${typeColors[ev.type]}`}
                          onClick={() => {
                            setEdit(ev);
                            setOpen(true);
                          }}
                          title={ev.title}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {events.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{events.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">This month</h3>
        <div className="border rounded-lg divide-y">
          {rows.map((r) => (
            <div
              key={r.id}
              className="p-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border capitalize ${typeColors[r.type]}`}
                  >
                    {r.type}
                  </span>
                  <span className="font-medium">{r.title}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.startDate}
                  {r.endDate !== r.startDate && ` → ${r.endDate}`}
                  {r.location && ` · ${r.location}`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEdit(r);
                    setOpen(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("Delete event?")) return;
                    await delFn({ data: { id: r.id } });
                    refresh();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {!rows.length && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No events this month
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit" : "New"} event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={edit?.title ?? ""}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={edit?.type ?? "event"}
                  onValueChange={(v) =>
                    setEdit({ ...edit, type: v as Event["type"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={edit?.location ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, location: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={edit?.startDate ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={edit?.endDate ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={edit?.description ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
