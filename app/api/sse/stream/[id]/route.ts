import type { NextRequest } from "next/server";
import { sseStream } from "@/lib/sse/bus";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { emit, subscribe } from "@/lib/sse/bus";

const viewerCounts = new Map<string, Set<string>>();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewerId = crypto.randomUUID();

  if (!viewerCounts.has(id)) viewerCounts.set(id, new Set());
  const set = viewerCounts.get(id)!;
  set.add(viewerId);

  await db
    .update(schema.streams)
    .set({ viewerCount: set.size, peakViewerCount: sql`GREATEST(peak_viewer_count, ${set.size})` })
    .where(eq(schema.streams.id, id));
  emit(`stream:${id}:viewers`, { count: set.size });

  const topic = `stream:${id}:*`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const row = (
        await db
          .select()
          .from(schema.streams)
          .where(eq(schema.streams.id, id))
          .limit(1)
      )[0];
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "hello", viewerCount: set.size, isLive: row?.isLive ?? false })}\n\n`
        )
      );

      const unsubs = [
        subscribe(`stream:${id}:viewers`, (p) =>
          controller.enqueue(encoder.encode(`event: viewers\ndata: ${JSON.stringify(p)}\n\n`))
        ),
        subscribe(`stream:${id}:status`, (p) =>
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(p)}\n\n`))
        ),
      ];

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 30_000);

      const onAbort = () => {
        clearInterval(heartbeat);
        unsubs.forEach((u) => u());
        set.delete(viewerId);
        void db
          .update(schema.streams)
          .set({ viewerCount: set.size })
          .where(eq(schema.streams.id, id));
        emit(`stream:${id}:viewers`, { count: set.size });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", onAbort);
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

void sseStream;
