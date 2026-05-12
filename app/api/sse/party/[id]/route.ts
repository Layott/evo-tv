import type { NextRequest } from "next/server";
import { subscribe } from "@/lib/sse/bus";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "hello", partyId: id })}\n\n`),
      );

      const unsubs = [
        subscribe(`party:${id}:presence`, (p) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(p)}\n\n`),
            );
          } catch {
            /* closed */
          }
        }),
        subscribe(`party:${id}:sync`, (p) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(p)}\n\n`),
            );
          } catch {
            /* closed */
          }
        }),
        subscribe(`party:${id}:ended`, (p) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(p)}\n\n`),
            );
          } catch {
            /* closed */
          }
        }),
      ];

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 30_000);

      return () => {
        clearInterval(heartbeat);
        unsubs.forEach((u) => u());
      };
    },
    cancel() {
      /* cleanup via start return */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
