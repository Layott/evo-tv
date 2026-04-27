import type { NextRequest } from "next/server";
import { subscribe } from "@/lib/sse/bus";
import { getCurrentUser } from "@/lib/auth/guards";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Auth required", { status: 401 });

  const encoder = new TextEncoder();
  const topic = `user:${user.id}:notification`;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "hello" })}\n\n`));
      const unsub = subscribe(topic, (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
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
    },
  });
}
