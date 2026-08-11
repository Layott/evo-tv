"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  Film,
  Loader2,
  Package,
  Play,
  Star,
  UserPlus,
  AlertCircle,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

import { useMockAuth } from "@/components/providers";
import {
  listNotifications,
  markAllAsRead,
  markAsRead,
} from "@/lib/client";
import type { NotificationItem, NotificationType } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/components/profile/ngn";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, React.ElementType> = {
  stream_live: Play,
  event_starting: Calendar,
  new_vod: Film,
  follow: UserPlus,
  order_update: Package,
  subscription: Star,
  system: AlertCircle,
};

function Row({
  n,
  onClick,
}: {
  n: NotificationItem;
  onClick: () => void;
}) {
  const Icon = ICONS[n.type] ?? Bell;
  const unread = n.readAt === null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-neutral-800 p-4 text-left transition hover:bg-neutral-900",
        unread ? "bg-sky-500/5" : ""
      )}
    >
      <div className="relative shrink-0">
        {n.imageUrl ? (
          <Image
            src={n.imageUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 rounded-lg bg-neutral-800 object-cover"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-lg bg-neutral-800">
            <Icon className="size-5 text-sky-400" />
          </div>
        )}
        {unread ? (
          <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-neutral-950 bg-sky-500" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", unread ? "font-semibold text-neutral-50" : "text-neutral-200")}>
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{n.body}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500">
          {relativeTime(n.createdAt)}
        </p>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const { user } = useMockAuth();
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await listNotifications(user.id);
      setItems(list);
      setLoading(false);
    })();
  }, [user]);

  async function handleClick(n: NotificationItem) {
    if (n.readAt === null) {
      await markAsRead(n.id);
      setItems((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, readAt: new Date().toISOString() } : p))
      );
    }
    if (n.linkUrl && n.linkUrl !== "#") {
      router.push(n.linkUrl);
    }
  }

  async function handleMarkAll() {
    if (!user) return;
    await markAllAsRead(user.id);
    const ts = new Date().toISOString();
    setItems((prev) => prev.map((p) => (p.readAt === null ? { ...p, readAt: ts } : p)));
    toast.success("All notifications marked as read");
  }

  const unread = items.filter((i) => i.readAt === null);
  const read = items.filter((i) => i.readAt !== null);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Notifications</h1>
          <p className="text-sm text-neutral-400">
            {unread.length} unread &middot; {items.length} total
          </p>
        </div>
        <Button
          onClick={handleMarkAll}
          variant="outline"
          className="border-neutral-800"
          disabled={unread.length === 0}
        >
          <CheckCheck className="size-4" />
          Mark all read
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="bg-neutral-900/60">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
            {items.length === 0 ? (
              <EmptyState />
            ) : (
              items.map((n) => <Row key={n.id} n={n} onClick={() => handleClick(n)} />)
            )}
          </div>
        </TabsContent>
        <TabsContent value="unread" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
            {unread.length === 0 ? (
              <EmptyState label="You&apos;re all caught up." />
            ) : (
              unread.map((n) => <Row key={n.id} n={n} onClick={() => handleClick(n)} />)
            )}
          </div>
        </TabsContent>
        <TabsContent value="read" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
            {read.length === 0 ? (
              <EmptyState />
            ) : (
              read.map((n) => <Row key={n.id} n={n} onClick={() => handleClick(n)} />)
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ label = "Nothing here yet." }: { label?: string }) {
  return (
    <div className="p-10 text-center">
      <Bell className="mx-auto size-10 text-neutral-600" />
      <p className="mt-3 text-sm font-semibold text-neutral-300">{label}</p>
    </div>
  );
}
