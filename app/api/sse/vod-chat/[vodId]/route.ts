import type { NextRequest } from "next/server";
import { subscribe } from "@/lib/sse/bus";

/**
 * GET /api/sse/vod-chat/[vodId]
 *
 * The live feed for a recording's chat. Same frames as the live one
 * (`message`, `deleted`, `pinned`), because the page rendering them is the same
 * component: somebody reading a comment thread should see a reply arrive
 * without refreshing, exactly as they would during a broadcast.
 */
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vodId: string }> },
) {
  const { vodId } = await params;
  const topic = `vod:${vodId}:chat`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "hello", vodId })}\n\n`),
      );
      const unsub = subscribe(topic, (payload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* closed */
        }
      });
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 30_000);
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
