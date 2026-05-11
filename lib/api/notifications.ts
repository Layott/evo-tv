import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { NotificationItem, NotificationType } from "@/lib/types";

function toNotif(r: typeof schema.notifications.$inferSelect): NotificationItem {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    imageUrl: r.imageUrl,
    linkUrl: r.linkUrl,
    readAt: r.readAt,
    createdAt: r.createdAt,
  };
}

export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  return (
    await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
  ).map(toNotif);
}

export async function countUnread(userId: string): Promise<number> {
  return (
    await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          isNull(schema.notifications.readAt)
        )
      )
  ).length;
}

export async function markAsRead(id: string): Promise<void> {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(eq(schema.notifications.id, id));
}

export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt)
      )
    );
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
}): Promise<NotificationItem> {
  const id =
    "notif_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const createdAt = new Date().toISOString();
  await db
    .insert(schema.notifications)
    .values({
      id,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      imageUrl: input.imageUrl ?? null,
      linkUrl: input.linkUrl ?? null,
      readAt: null,
      createdAt,
    });
  return {
    id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    imageUrl: input.imageUrl ?? null,
    linkUrl: input.linkUrl ?? null,
    readAt: null,
    createdAt,
  };
}
