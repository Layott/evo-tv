import type { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { emit, subscribe } from "@/lib/sse/bus";
import { join, leave, refresh } from "@/lib/sse/presence";
import { getCurrentUser } from "@/lib/auth/guards";
import { hasMinRole } from "@/lib/auth/roles";

/**
 * Live status and viewer count for one stream.
 *
 * The count used to live in a `Map` in this module, which meant it counted the
 * viewers this container was serving rather than the viewers watching. Two
 * `api` containers therefore reported half the audience each, and whichever
 * wrote last was the number on screen. It is a Valkey sorted set now, shared
 * by every container: see `lib/sse/presence.ts`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The audience size goes out on this channel every 30s, so it needs the same
  // staff gate the REST endpoints have. Resolved once at connect: a session
  // does not change role mid-stream.
  const user = await getCurrentUser();
  const admin = hasMinRole((user as { role?: string } | null)?.role, "admin");
  const viewerId = crypto.randomUUID();
  const topic = `stream:${id}`;

  const initialCount = await join(topic, viewerId);

  await db
    .update(schema.streams)
    .set({
      viewerCount: initialCount,
      peakViewerCount: sql`GREATEST(peak_viewer_count, ${initialCount})`,
    })
    .where(eq(schema.streams.id, id));
  emit(`stream:${id}:viewers`, { count: initialCount });

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
          `data: ${JSON.stringify({
            type: "hello",
            ...(admin ? { viewerCount: initialCount } : {}),
            isLive: row?.isLive ?? false,
          })}\n\n`
        )
      );

      const unsubs = [
        // Viewer counts are staff only, so a non-admin never subscribes to the
        // topic rather than being sent it and trusted to ignore it.
        ...(admin
          ? [
              subscribe(`stream:${id}:viewers`, (p) =>
                controller.enqueue(
                  encoder.encode(`event: viewers\ndata: ${JSON.stringify(p)}\n\n`),
                ),
              ),
            ]
          : []),
        subscribe(`stream:${id}:status`, (p) =>
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(p)}\n\n`))
        ),
      ];

      // The heartbeat does double duty: it keeps the connection from being
      // reaped by an idle proxy, and it renews this viewer's presence. A
      // viewer who stops being renewed ages out of the count, which is how a
      // container that dies without cleaning up stops inflating it.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
        void refresh(topic, viewerId).then((count) => {
          void db
            .update(schema.streams)
            .set({
              viewerCount: count,
              peakViewerCount: sql`GREATEST(peak_viewer_count, ${count})`,
            })
            .where(eq(schema.streams.id, id));
        });
      }, 30_000);

      const onAbort = () => {
        clearInterval(heartbeat);
        unsubs.forEach((u) => u());
        void leave(topic, viewerId).then((count) => {
          void db
            .update(schema.streams)
            .set({ viewerCount: count })
            .where(eq(schema.streams.id, id));
          emit(`stream:${id}:viewers`, { count });
        });
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
