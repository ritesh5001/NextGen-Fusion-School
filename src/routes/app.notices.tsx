import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotices,
  saveNotice,
  deleteNotice,
} from "@/lib/notices.functions";
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
import { Plus, Trash2, Pencil, Pin } from "lucide-react";

export const Route = createFileRoute("/app/notices")({
  component: NoticesPage,
});

type Notice = {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishFrom: string | null;
  publishTo: string | null;
  isPinned: boolean;
  isPublished: boolean;
  createdAt: string | Date;
};

function NoticesPage() {
  const listFn = useServerFn(listNotices);
  const saveFn = useServerFn(saveNotice);
  const delFn = useServerFn(deleteNotice);

  const [rows, setRows] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Notice> | null>(null);

  async function refresh() {
    const r = await listFn();
    setRows(r as Notice[]);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    if (!edit?.title || !edit?.body) return toast.error("Title and body required");
    try {
      await saveFn({
        data: {
          id: edit.id,
          title: edit.title!,
          body: edit.body!,
          audience: edit.audience ?? "all",
          publishFrom: edit.publishFrom ?? null,
          publishTo: edit.publishTo ?? null,
          isPinned: edit.isPinned ?? false,
          isPublished: edit.isPublished ?? true,
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
        title="Notice Board"
        description="Publish announcements to students, staff, and parents"
        action={
          <Button
            onClick={() => {
              setEdit({ audience: "all", isPinned: false, isPublished: true });
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New notice
          </Button>
        }
      />

      <div className="grid gap-4">
        {rows.map((n) => (
          <div
            key={n.id}
            className="border rounded-lg p-4 space-y-2 hover:border-primary/40 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {n.isPinned && (
                    <Pin className="w-3.5 h-3.5 text-primary" />
                  )}
                  <h3 className="font-semibold text-lg">{n.title}</h3>
                  {!n.isPublished && (
                    <span className="text-xs px-2 py-0.5 rounded bg-muted">
                      Draft
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded bg-muted capitalize">
                    {n.audience}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {n.body}
                </p>
                <div className="text-xs text-muted-foreground mt-2">
                  {n.publishFrom && `From ${n.publishFrom}`}
                  {n.publishTo && ` · Until ${n.publishTo}`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEdit(n);
                    setOpen(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("Delete notice?")) return;
                    await delFn({ data: { id: n.id } });
                    refresh();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="text-center text-muted-foreground py-12 border rounded-lg">
            No notices yet
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit" : "New"} notice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={edit?.title ?? ""}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                rows={6}
                value={edit?.body ?? ""}
                onChange={(e) => setEdit({ ...edit, body: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Audience</Label>
                <Select
                  value={edit?.audience ?? "all"}
                  onValueChange={(v) => setEdit({ ...edit, audience: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                    <SelectItem value="teachers">Teachers</SelectItem>
                    <SelectItem value="parents">Parents</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Publish from</Label>
                <Input
                  type="date"
                  value={edit?.publishFrom ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, publishFrom: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Publish until</Label>
                <Input
                  type="date"
                  value={edit?.publishTo ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, publishTo: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit?.isPinned ?? false}
                  onChange={(e) =>
                    setEdit({ ...edit, isPinned: e.target.checked })
                  }
                />
                Pin to top
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit?.isPublished ?? true}
                  onChange={(e) =>
                    setEdit({ ...edit, isPublished: e.target.checked })
                  }
                />
                Published
              </label>
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
