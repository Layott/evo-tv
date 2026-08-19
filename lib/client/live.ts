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
): Promise<ChatMessage | null> {
  const res = await apiSend<{ message: ChatMessage }>(
    "POST",
    `/api/streams/${encodeURIComponent(streamId)}/chat`,
    { body },
  );
  return res?.message ?? null;
}

/**
 * Moderation, with named arguments on purpose.
 *
 * These took `(streamId, messageId)` positionally and the chat called them
 * `(messageId, handle)`. Two strings, so nothing failed to compile: the request
 * went to `/api/streams/<messageId>/chat/<handle>/pin`, which is a 404, and
 * every click answered "Could not pin message". An object cannot be passed in
 * the wrong order.
 */
export async function pinMessage(args: {
  streamId: string;
  messageId: string;
}): Promise<{ isPinned: boolean } | null> {
  return apiSend<{ isPinned: boolean }>(
    "POST",
    `/api/streams/${encodeURIComponent(args.streamId)}/chat/${encodeURIComponent(args.messageId)}/pin`,
  );
}

export async function deleteMessage(args: {
  streamId: string;
  messageId: string;
}): Promise<void> {
  await apiSend<void>(
    "POST",
    `/api/streams/${encodeURIComponent(args.streamId)}/chat/${encodeURIComponent(args.messageId)}/delete`,
  );
}

/**
 * Ban the author of a message from chat for a while.
 *
 * This used to post `{ action: "ban" }` at the partner channel endpoint with
 * the stream id in the channel's place. That endpoint has no "ban" action, it
 * has "timeout", and a timeout only emits an event: nothing was written, so a
 * banned viewer was talking again after a reload. It now writes the same
 * `chat_banned` sanction the moderation queue writes, which `isChatBlocked`
 * enforces on the next message and which expires on its own.
 */
export async function banFromChat(args: {
  streamId: string;
  messageId: string;
  hours?: number;
  reason?: string;
}): Promise<{ expiresAt: string } | null> {
  return apiSend<{ expiresAt: string }>(
    "POST",
    `/api/streams/${encodeURIComponent(args.streamId)}/chat/${encodeURIComponent(args.messageId)}/ban`,
    { hours: args.hours ?? 24, ...(args.reason ? { reason: args.reason } : {}) },
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
