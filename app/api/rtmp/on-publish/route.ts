import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashStreamKey } from "@/lib/video/stream-key";
import { emit } from "@/lib/sse/bus";

/**
 * Invoked by nginx-rtmp on RTMP publish start.
 * nginx posts form-urlencoded: `name=<stream_key>&app=live&addr=<ip>`.
 * Must respond 2xx to allow publish; any non-2xx rejects the connection.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const streamKey = params.get("name");
  if (!streamKey) return new NextResponse("Missing stream key", { status: 400 });

  const keyHash = hashStreamKey(streamKey);
  const row = db
    .select()
    .from(schema.streams)
    .where(eq(schema.streams.streamKeyHash, keyHash))
    .get();

  if (!row) return new NextResponse("Unknown stream key", { status: 403 });
  if (row.streamerType !== "official") {
    return new NextResponse("Creator streams not permitted in MVP", { status: 403 });
  }

  const nowIso = new Date().toISOString();
  db.update(schema.streams)
    .set({
      isLive: true,
      startedAt: nowIso,
      endedAt: null,
      hlsPath: `/hls/${streamKey}.m3u8`,
      viewerCount: 0,
    })
    .where(eq(schema.streams.id, row.id))
    .run();

  emit(`stream:${row.id}:status`, { isLive: true, startedAt: nowIso });
  emit("stream:live-now", { streamId: row.id });

  return new NextResponse("OK", { status: 200 });
}
