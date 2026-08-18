import type { NextRequest } from "next/server";
import { sseStream } from "@/lib/sse/bus";

/**
 * GET /api/sse/channel
 *
 * Tells the home page the moment the channel comes on air.
 *
 * The hero polled every sixty seconds, which is why a viewer sitting on the
 * home page watched an "Off air" card through the start of a broadcast and had
 * to reload to see it. A minute of staleness reads as a broken page when the
 * thing you are waiting for has visibly started somewhere else.
 *
 * `on-publish` already emits `stream:live-now` and `on-publish-done` emits the
 * matching offline event; nothing was listening on the web. This subscribes to
 * that existing signal rather than polling harder, so the page updates within a
 * second of the encoder connecting and makes no requests at all while nothing
 * is happening.
 *
 * The payload is deliberately just a nudge. The client refetches
 * `/api/channel/main` on receipt rather than trusting a partial object pushed
 * down a pipe, so there is one source of truth for what is on air.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  /*
   * The hello frame is not decoration. Without it the connection sends nothing
   * until a broadcast starts, so a proxy sees an idle stream and may close it,
   * and the client cannot tell "connected and waiting" from "never opened".
   * The client ignores the contents and refetches on any message.
   */
  return new Response(sseStream("stream:live-now", () => ({ type: "hello" })), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Caddy and any proxy in front must not buffer this or events arrive in
      // batches long after they were emitted, which defeats the point.
      "X-Accel-Buffering": "no",
    },
  });
}
