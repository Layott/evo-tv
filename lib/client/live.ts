import type { ChatMessage, Poll } from "@/lib/types";
import { apiGet, apiSend } from "./_fetch";

/**
 * Live-stream surfaces: chat, polls, and the subscription tier catalogue.
 *
 * Chat history and polls are per stream. Live delivery is not here: the page
 * subscribes to `/api/sse/chat/[streamId]` for new messages, which is why the
 * old `makeIncomingMessage` fake-traffic generator has no replacement.
 */

/* ── Chat ───────────────────────────────────────────────────────────────── */

export async function listInitialMessages(
  streamId: string,
): Promise<ChatMessage[]> {
  const res = await apiGet<{ messages: ChatMessage[] }>(
    `/api/streams/${encodeURIComponent(streamId)}/chat`,
  );
  return res?.messages ?? [];
}

/**
 * Post a message and return the server's row.
 *
 * The response is `{ message }`, and this used to hand the wrapper back as if
 * it were the message. Every field the caller read was therefore undefined, and
 * because the chat replaces its optimistic row with whatever comes back, the
 * message you had just typed turned into a blank line attributed to "viewer"
 * the instant the request completed.
 *
 * It also caused the duplicates. The chat dedupes the copy arriving over SSE by
 * comparing ids, and the replaced row had `id: undefined`, so nothing matched
 * and the same message was appended a second time. It showed up most on phones
 * simply because a slower round trip gives SSE more chances to win the race.
 *
 * The list endpoint unwraps `{ messages }` correctly; only this one forgot.
 */
export async function sendMessage(
  streamId: string,
  body: string,
  parentId?: string | null,
): Promise<ChatMessage | null> {
  const res = await apiSend<{ message: ChatMessage }>(
    "POST",
    `/api/streams/${encodeURIComponent(streamId)}/chat`,
    { body, ...(parentId ? { parentId } : {}) },
  );
  return res?.message ?? null;
}

/** The same chat, under a recording. */
export async function listVodMessages(vodId: string): Promise<ChatMessage[]> {
  const res = await apiGet<{ messages: ChatMessage[] }>(
    `/api/vods/${encodeURIComponent(vodId)}/chat`,
  );
  return res?.messages ?? [];
}

export async function sendVodMessage(
  vodId: string,
  body: string,
  parentId?: string | null,
): Promise<ChatMessage | null> {
  const res = await apiSend<{ message: ChatMessage }>(
    "POST",
    `/api/vods/${encodeURIComponent(vodId)}/chat`,
    { body, ...(parentId ? { parentId } : {}) },
  );
  return res?.message ?? null;
}

/**
 * Moderation, addressed by the message.
 *
 * These took the stream id as well, which stopped being true the day chat
 * appeared under a recording: the same three buttons would have needed a second
 * set of endpoints and a client that knew which kind of page it was on. A
 * message knows where it lives; nothing else has to.
 *
 * They also took two positional strings, and the chat passed them in the wrong
 * order for weeks without anything failing to compile. One argument now, and it
 * is the one the buttons already have.
 */
export async function pinMessage(messageId: string): Promise<{ isPinned: boolean } | null> {
  return apiSend<{ isPinned: boolean }>(
    "POST",
    `/api/chat/${encodeURIComponent(messageId)}/mod`,
    { action: "pin" },
  );
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiSend<void>("POST", `/api/chat/${encodeURIComponent(messageId)}/mod`, {
    action: "delete",
  });
}

export async function banFromChat(args: {
  messageId: string;
  hours?: number;
  reason?: string;
}): Promise<{ expiresAt: string } | null> {
  return apiSend<{ expiresAt: string }>(
    "POST",
    `/api/chat/${encodeURIComponent(args.messageId)}/mod`,
    { action: "ban", hours: args.hours ?? 24, ...(args.reason ? { reason: args.reason } : {}) },
  );
}

/* ── Polls ──────────────────────────────────────────────────────────────── */

export async function listPollsForStream(streamId: string): Promise<Poll[]> {
  const res = await apiGet<{ polls: Poll[] }>(
    `/api/streams/${encodeURIComponent(streamId)}/polls`,
  );
  return res?.polls ?? [];
}

export async function listActivePolls(streamId: string): Promise<Poll[]> {
  const polls = await listPollsForStream(streamId);
  return polls.filter((p) => !p.isClosed);
}

export async function votePoll(
  pollId: string,
  optionId: string,
): Promise<Poll | null> {
  const res = await apiSend<{ poll: Poll }>(
    "POST",
    `/api/polls/${encodeURIComponent(pollId)}/vote`,
    { optionId },
  );
  return res?.poll ?? null;
}

/* ── Tiers ──────────────────────────────────────────────────────────────── */

/** Mirrors the interface in `lib/api/tiers.ts`, which is a server module. */
export interface Tier {
  id: "free" | "supporter" | "premium" | "pro";
  name: string;
  priceNgn: number;
  periodDays: number;
  features: string[];
  tagline: string;
  cta: string;
}

/**
 * The subscription tier catalogue. Exported as a function because it is a
 * network read now; the mock exported a `tiers` constant, so call sites that
 * expected the array use `listTiers()`.
 */
export async function listTiers(): Promise<Tier[]> {
  const data = await apiGet<Tier[]>("/api/tiers");
  return Array.isArray(data) ? data : [];
}
