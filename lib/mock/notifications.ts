import type { NotificationItem } from "@/lib/types";
import { sleep, hoursAgo, daysAgo } from "./_util";
import { notifIcon, playerAvatar } from "./_media";

export const notifications: NotificationItem[] = [
  {
    id: "notif_1",
    userId: "user_current",
    type: "stream_live",
    title: "EVO Lagos Invitational is LIVE",
    body: "Team Alpha vs Nova Esports — Semifinal 1 just kicked off.",
    imageUrl: notifIcon("notif_lagos"),
    linkUrl: "/stream/stream_lagos_final",
    readAt: null,
    createdAt: hoursAgo(1),
  },
  {
    id: "notif_2",
    userId: "user_current",
    type: "event_starting",
    title: "EVO Championship starts in 2 hours",
    body: "You're signed up for reminders for EVO Championship 2026.",
    imageUrl: notifIcon("notif_afc"),
    linkUrl: "/events/event_afc_championship",
    readAt: null,
    createdAt: hoursAgo(2),
  },
  {
    id: "notif_3",
    userId: "user_current",
    type: "new_vod",
    title: "New VOD: EVO Championship Week 4 Recap",
    body: "The weekly recap is live. 42 minutes.",
    imageUrl: notifIcon("notif_vod"),
    linkUrl: "/vod/vod_1",
    readAt: null,
    createdAt: hoursAgo(6),
  },
  {
    id: "notif_4",
    userId: "user_current",
    type: "order_update",
    title: "Your order has shipped",
    body: "Team Alpha Jersey is on the way. Track: NIPOST-9F3A1K",
    imageUrl: "/team-alpha-jersey.jpg",
    linkUrl: "/profile/orders/order_recent",
    readAt: hoursAgo(10),
    createdAt: hoursAgo(24),
  },
  {
    id: "notif_5",
    userId: "user_current",
    type: "follow",
    title: "Viper followed you back",
    body: "Check their profile and latest clips.",
    imageUrl: playerAvatar("Viper"),
    linkUrl: "/profile/viper",
    readAt: hoursAgo(40),
    createdAt: daysAgo(2),
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `notif_hist_${i}`,
    userId: "user_current",
    type: (["new_vod", "stream_live", "event_starting", "system"] as const)[
      i % 4
    ],
    title: [
      "Nova Esports uploaded a new clip",
      "Weekly digest is here",
      "PUBG Mobile Casablanca is LIVE",
      "Premium price update",
      "Your favorite team won!",
      "New episode: Evo Talk",
      "Maintenance complete",
      "Cairo Cup bracket released",
      "You reached level 5",
      "Server upgraded — please refresh",
    ][i]!,
    body: "Tap to read more.",
    imageUrl: null,
    linkUrl: "#",
    readAt: daysAgo(i + 2),
    createdAt: daysAgo(i + 2),
  })),
];

export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  await sleep();
  return notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function countUnread(userId: string): Promise<number> {
  await sleep(30);
  return notifications.filter((n) => n.userId === userId && n.readAt === null).length;
}

export async function markAsRead(id: string): Promise<void> {
  await sleep(30);
  const n = notifications.find((n) => n.id === id);
  if (n) n.readAt = new Date().toISOString();
}

export async function markAllAsRead(userId: string): Promise<void> {
  await sleep(30);
  const ts = new Date().toISOString();
  notifications.forEach((n) => {
    if (n.userId === userId && n.readAt === null) n.readAt = ts;
  });
}
