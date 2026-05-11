import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashStreamKey } from "@/lib/video/stream-key";
import { emit } from "@/lib/sse/bus";
import "@/workers/transcode"; // auto-registers transcode worker

/** nginx-rtmp fires this when publisher disconnects. */
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
      .where(eq(schema.streams.streamKeyHash, keyHash))
      .limit(1)
  )[0];
  if (!row) return new NextResponse("Unknown stream key", { status: 404 });

  const nowIso = new Date().toISOString();
  await db
    .update(schema.streams)
    .set({ isLive: false, endedAt: nowIso })
    .where(eq(schema.streams.id, row.id));

  emit(`stream:${row.id}:status`, { isLive: false, endedAt: nowIso });
  emit("stream:enqueue-transcode", { streamId: row.id });

  return new NextResponse("OK", { status: 200 });
}
