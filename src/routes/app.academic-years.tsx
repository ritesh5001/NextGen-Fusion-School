import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listAcademicYears,
  saveAcademicYear,
  deleteAcademicYear,
} from "@/lib/academic.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/academic-years")({
  component: AcademicYearsPage,
});

type Year = {
  id: string;
  name: string;
  startsOn: string | Date;
  endsOn: string | Date;
  isCurrent: boolean;
};

function AcademicYearsPage() {
  const list = useServerFn(listAcademicYears);
  const save = useServerFn(saveAcademicYear);
  const del = useServerFn(deleteAcademicYear);

  const [rows, setRows] = useState<Year[] | null>(null);
  const [editing, setEditing] = useState<Year | null>(null);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      setRows((await list()) as Year[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(y: Year) {
    setEditing(y);
    setOpen(true);
  }

  async function onSubmit(form: FormData) {
    try {
      await save({
        data: {
          id: editing?.id,
          name: String(form.get("name") ?? ""),
          startsOn: String(form.get("startsOn") ?? ""),
          endsOn: String(form.get("endsOn") ?? ""),
          isCurrent: form.get("isCurrent") === "on",
        },
      });
      toast.success("Saved");
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const toISODate = (v: string | Date) =>
    new Date(v).toISOString().slice(0, 10);

  return (
    <div className="p-8">
      <PageHeader
        title="Academic Years"
        description="Set up school years. The current year is the default context for classes and results."
        action={
          <Button onClick={openNew}>
            <Plus className="mr-2 size-4" /> Add academic year
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[1%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No academic years yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((y) => (
                <TableRow key={y.id}>
                  <TableCell className="font-medium">{y.name}</TableCell>
                  <TableCell>{toISODate(y.startsOn)}</TableCell>
                  <TableCell>{toISODate(y.endsOn)}</TableCell>
                  <TableCell>
                    {y.isCurrent ? <Badge>Current</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(y)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete "${y.name}"?`)) return;
                        try {
                          await del({ data: { id: y.id } });
                          toast.success("Deleted");
                          refresh();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit academic year" : "New academic year"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="2025-2026"
                defaultValue={editing?.name ?? ""}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startsOn">Starts on</Label>
                <Input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  defaultValue={editing ? toISODate(editing.startsOn) : ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endsOn">Ends on</Label>
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  defaultValue={editing ? toISODate(editing.endsOn) : ""}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Switch id="isCurrent" name="isCurrent" defaultChecked={editing?.isCurrent ?? false} />
              <Label htmlFor="isCurrent" className="cursor-pointer">
                Mark as current year
              </Label>
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
