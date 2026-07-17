import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} from "@/lib/notifications.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Trash2, CheckCheck, Bell, BellOff, Circle } from "lucide-react";

export const Route = createFileRoute("/app/notifications")({
  component: NotificationsPage,
});

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  category: string;
  isRead: boolean;
  createdAt: string | Date;
};

function NotificationsPage() {
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllRead);
  const delFn = useServerFn(deleteNotification);

  const [rows, setRows] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function refresh() {
    const r = await listFn({ data: { filter, limit: 100 } });
    setRows(r.rows as unknown as Notif[]);
    setUnread(r.unread);
  }
  useEffect(() => {
    refresh();
  }, [filter]);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="Notifications"
        description={`Your inbox${unread ? ` · ${unread} unread` : ""}`}
        action={
          <Button
            variant="outline"
            onClick={async () => {
              await markAll();
              toast.success("All marked read");
              refresh();
            }}
            disabled={!unread}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {unread ? `(${unread})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-lg divide-y">
        {rows.map((n) => (
          <div
            key={n.id}
            className={`p-4 flex items-start gap-3 ${
              !n.isRead ? "bg-primary/5" : ""
            }`}
          >
            <div className="pt-1">
              {n.isRead ? (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Circle className="w-2.5 h-2.5 fill-primary text-primary" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{n.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted uppercase tracking-wider">
                  {n.category}
                </span>
              </div>
              {n.body && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {n.body}
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(n.createdAt).toLocaleString()}
                {n.link && (
                  <>
                    {" · "}
                    <a href={n.link} className="text-primary hover:underline">
                      Open
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                title={n.isRead ? "Mark unread" : "Mark read"}
                onClick={async () => {
                  await markFn({
                    data: { id: n.id, isRead: !n.isRead },
                  });
                  refresh();
                }}
              >
                <Bell className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await delFn({ data: { id: n.id } });
                  refresh();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="p-12 text-center text-muted-foreground">
            {filter === "unread"
              ? "You're all caught up"
              : "No notifications yet"}
          </div>
        )}
      </div>
    </div>
  );
}
