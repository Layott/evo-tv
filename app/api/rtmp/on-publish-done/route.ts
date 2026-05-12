import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { hashStreamKey } from "@/lib/video/stream-key";
import { emit } from "@/lib/sse/bus";
import "@/workers/transcode"; // auto-registers transcode worker

/**
 * nginx-rtmp fires this when publisher disconnects.
 *
 * Multi-tenant note: Phase 3.4 inserts a new streams row per go-live, so
 * we must match on (key_hash, is_live=true) to find the active row instead
 * of just the most-recent. Tie-break: most-recent `created_at`.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const streamKey = params.get("name");
  if (!streamKey) return new NextResponse("Missing stream key", { status: 400 });

  const keyHash = hashStreamKey(streamKey);
  const row = (
    await db
      .select()
      .from(schema.streams)
      .where(
        and(
          eq(schema.streams.streamKeyHash, keyHash),
          eq(schema.streams.isLive, true),
        ),
      )
      .orderBy(desc(schema.streams.createdAt))
      .limit(1)
  )[0];
  if (!row) return new NextResponse("No active stream for key", { status: 404 });

  const nowIso = new Date().toISOString();
  await db
    .update(schema.streams)
    .set({ isLive: false, endedAt: nowIso })
    .where(eq(schema.streams.id, row.id));

  emit(`stream:${row.id}:status`, { isLive: false, endedAt: nowIso });
  if (row.channelId) {
    emit(`channel:${row.channelId}:offline`, { streamId: row.id });
  }
  emit("stream:enqueue-transcode", { streamId: row.id });

  return new NextResponse("OK", { status: 200 });
}
