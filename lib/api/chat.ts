import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emit } from "@/lib/sse/bus";
import type { ChatMessage, Role } from "@/lib/types";

function shortId(prefix: string): string {
  return (
    prefix +
    "_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function toChatMessage(row: {
  id: string;
  streamId: string;
  userId: string;
  body: string;
  createdAt: string;
  isDeleted: boolean;
  isPinned: boolean;
  userHandle: string | null;
  userName: string | null;
  userImage: string | null;
  userRole: string | null;
}): ChatMessage {
  return {
    id: row.id,
    streamId: row.streamId,
    userId: row.userId,
    userHandle: row.userHandle ?? row.userName ?? "unknown",
    userAvatarUrl: row.userImage ?? "",
    userRole: (row.userRole as Role | null) ?? "user",
    body: row.body,
    createdAt: row.createdAt,
    isDeleted: row.isDeleted,
    isPinned: row.isPinned,
  };
}

/**
 * Return the most recent `limit` messages for a stream, ordered oldest → newest.
 */
export async function listInitialMessages(
  streamId: string,
  limit = 50
): Promise<ChatMessage[]> {
  // Pull most-recent `limit` rows then reverse so callers get chronological order.
  const recent = await db
    .select({
      id: schema.chatMessages.id,
      streamId: schema.chatMessages.streamId,
      userId: schema.chatMessages.userId,
      body: schema.chatMessages.body,
      createdAt: schema.chatMessages.createdAt,
      isDeleted: schema.chatMessages.isDeleted,
      isPinned: schema.chatMessages.isPinned,
      userHandle: schema.user.handle,
      userName: schema.user.name,
      userImage: schema.user.image,
      userRole: schema.user.role,
    })
    .from(schema.chatMessages)
    .leftJoin(schema.user, eq(schema.user.id, schema.chatMessages.userId))
    .where(eq(schema.chatMessages.streamId, streamId))
    .orderBy(desc(schema.chatMessages.createdAt))
    .limit(limit);
  return recent.reverse().map(toChatMessage);
}

/**
 * Persist a new chat message and emit it to the stream's chat topic.
 * Returns the fully-hydrated ChatMessage.
 */
export async function postMessage(input: {
  streamId: string;
  userId: string;
  body: string;
}): Promise<ChatMessage> {
  const id = shortId("msg");
  const createdAt = new Date().toISOString();
  await db
    .insert(schema.chatMessages)
    .values({
      id,
      streamId: input.streamId,
      userId: input.userId,
      body: input.body,
      createdAt,
      isDeleted: false,
      isPinned: false,
    });

  const userRow = (
    await db
      .select({
        handle: schema.user.handle,
        name: schema.user.name,
        image: schema.user.image,
        role: schema.user.role,
      })
      .from(schema.user)
      .where(eq(schema.user.id, input.userId))
      .limit(1)
  )[0];

  const message: ChatMessage = {
    id,
    streamId: input.streamId,
    userId: input.userId,
    userHandle: userRow?.handle ?? userRow?.name ?? "unknown",
    userAvatarUrl: userRow?.image ?? "",
    userRole: (userRow?.role as Role | undefined) ?? "user",
    body: input.body,
    createdAt,
    isDeleted: false,
    isPinned: false,
  };
  emit(`stream:${input.streamId}:chat`, { type: "message", message });
  return message;
}

export async function deleteMessage(id: string): Promise<ChatMessage | null> {
  const row = (
    await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.id, id))
      .limit(1)
  )[0];
  if (!row) return null;
  await db
    .update(schema.chatMessages)
    .set({ isDeleted: true })
    .where(eq(schema.chatMessages.id, id));
  emit(`stream:${row.streamId}:chat`, { type: "deleted", messageId: id });
  return {
    id: row.id,
    streamId: row.streamId,
    userId: row.userId,
    userHandle: "",
    userAvatarUrl: "",
    userRole: "user",
    body: row.body,
    createdAt: row.createdAt,
    isDeleted: true,
    isPinned: row.isPinned,
  };
}

export async function pinMessage(id: string): Promise<{ isPinned: boolean } | null> {
  const row = (
    await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.id, id))
      .limit(1)
  )[0];
  if (!row) return null;
  const next = !row.isPinned;
  await db
    .update(schema.chatMessages)
    .set({ isPinned: next })
    .where(eq(schema.chatMessages.id, id));
  emit(`stream:${row.streamId}:chat`, {
    type: "pinned",
    messageId: id,
    isPinned: next,
  });
  return { isPinned: next };
}

export async function getMessageById(id: string): Promise<
  (typeof schema.chatMessages.$inferSelect) | null
> {
  const row = (
    await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.id, id))
      .limit(1)
  )[0];
  return row ?? null;
}

// Re-export for linter happiness / future ordering tweaks.
export { asc };
