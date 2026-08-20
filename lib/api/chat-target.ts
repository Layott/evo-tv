import "server-only";

/**
 * Where a chat message lives.
 *
 * Chat used to exist only under a live broadcast, so the moment a stream became
 * a recording every word said about it left the page. The same table now serves
 * both, which keeps one set of rules, one ban list, one moderation queue and one
 * SSE contract rather than a second implementation that drifts from the first.
 *
 * This type is the seam. Everything that reads or writes chat takes it, so no
 * call site has to remember which column applies.
 */
export type ChatTarget =
  | { kind: "stream"; id: string }
  | { kind: "vod"; id: string };

/** The pub/sub topic for a target, which is also the SSE route's path. */
export function chatTopic(target: ChatTarget): string {
  return `${target.kind}:${target.id}:chat`;
}

/** Parse the two columns back into a target. */
export function targetOf(row: {
  streamId: string | null;
  vodId: string | null;
}): ChatTarget | null {
  if (row.streamId) return { kind: "stream", id: row.streamId };
  if (row.vodId) return { kind: "vod", id: row.vodId };
  return null;
}
