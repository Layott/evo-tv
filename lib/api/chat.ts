import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emit } from "@/lib/sse/bus";
import { chatTopic, type ChatTarget } from "@/lib/api/chat-target";
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
  streamId: string | null;
  vodId?: string | null;
  parentId?: string | null;
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
    vodId: row.vodId ?? null,
    parentId: row.parentId ?? null,
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
  target: ChatTarget | string,
  limit = 50,
): Promise<ChatMessage[]> {
  // A bare string is still a stream id, because every existing caller passes one.
  const where =
    typeof target === "string" || target.kind === "stream"
      ? eq(schema.chatMessages.streamId, typeof target === "string" ? target : target.id)
      : eq(schema.chatMessages.vodId, target.id);

  // Pull most-recent `limit` rows then reverse so callers get chronological order.
  const recent = await db
    .select({
      id: schema.chatMessages.id,
      streamId: schema.chatMessages.streamId,
      vodId: schema.chatMessages.vodId,
      parentId: schema.chatMessages.parentId,
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
    .where(where)
    .orderBy(desc(schema.chatMessages.createdAt))
    .limit(limit);

  const messages = recent.reverse().map(toChatMessage);
  return withParents(messages);
}

/**
 * Attach the message each reply answers.
 *
 * One extra query for the whole page rather than one per reply, and only for
 * the parents that are not already on screen. A reply that quotes nothing reads
 * as a non-sequitur, which is the state chat threading exists to prevent.
 */
async function withParents(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const onScreen = new Map(messages.map((m) => [m.id, m]));
  const missing = [
    ...new Set(
      messages
        .map((m) => m.parentId)
        .filter((id): id is string => Boolean(id) && !onScreen.has(id!)),
    ),
  ];

  const fetched = new Map<string, { id: string; userHandle: string | null; body: string }>();
  if (missing.length > 0) {
    const rows = await db
      .select({
        id: schema.chatMessages.id,
        body: schema.chatMessages.body,
        isDeleted: schema.chatMessages.isDeleted,
        handle: schema.user.handle,
        name: schema.user.name,
      })
      .from(schema.chatMessages)
      .leftJoin(schema.user, eq(schema.user.id, schema.chatMessages.userId))
      .where(inArray(schema.chatMessages.id, missing));
    for (const row of rows) {
      fetched.set(row.id, {
        id: row.id,
        userHandle: row.handle ?? row.name ?? null,
        body: row.isDeleted ? "[message removed]" : row.body,
      });
    }
  }

  return messages.map((m) => {
    if (!m.parentId) return m;
    const local = onScreen.get(m.parentId);
    const parent = local
      ? {
          id: local.id,
          userHandle: local.userHandle,
          body: local.isDeleted ? "[message removed]" : local.body,
        }
      : (fetched.get(m.parentId) ?? null);
    return { ...m, parent };
  });
}

/**
 * Persist a new chat message and emit it to the stream's chat topic.
 * Returns the fully-hydrated ChatMessage.
 */
export async function postMessage(input: {
  /** A bare stream id still works: every existing caller passes one. */
  target?: ChatTarget;
  streamId?: string;
  userId: string;
  body: string;
  /** The message being answered, when this is a reply. */
  parentId?: string | null;
}): Promise<ChatMessage> {
  const target: ChatTarget =
    input.target ?? { kind: "stream", id: input.streamId ?? "" };
  const id = shortId("msg");
  const createdAt = new Date().toISOString();

  await db.insert(schema.chatMessages).values({
    id,
    streamId: target.kind === "stream" ? target.id : null,
    vodId: target.kind === "vod" ? target.id : null,
    parentId: input.parentId ?? null,
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
    streamId: target.kind === "stream" ? target.id : null,
    vodId: target.kind === "vod" ? target.id : null,
    parentId: input.parentId ?? null,
    userId: input.userId,
    userHandle: userRow?.handle ?? userRow?.name ?? "unknown",
    userAvatarUrl: userRow?.image ?? "",
    userRole: (userRow?.role as Role | undefined) ?? "user",
    body: input.body,
    createdAt,
    isDeleted: false,
    isPinned: false,
  };

  const [hydrated] = await withParents([message]);
  emit(chatTopic(target), { type: "message", message: hydrated ?? message });
  return hydrated ?? message;
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
  const target = row.streamId
    ? { kind: "stream" as const, id: row.streamId }
    : { kind: "vod" as const, id: row.vodId! };
  emit(chatTopic(target), { type: "deleted", messageId: id });
  return {
    id: row.id,
    streamId: row.streamId,
    vodId: row.vodId ?? null,
    parentId: row.parentId ?? null,
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
  const target = row.streamId
    ? { kind: "stream" as const, id: row.streamId }
    : { kind: "vod" as const, id: row.vodId! };
  emit(chatTopic(target), { type: "pinned", messageId: id, isPinned: next });
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
