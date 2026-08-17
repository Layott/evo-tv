import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { hashStreamKey } from "@/lib/video/stream-key";
import { emit } from "@/lib/sse/bus";
import "@/workers/transcode"; // auto-registers transcode worker
import { HLS_VARIANT_SUFFIXES } from "@/lib/video/ingest";

/**
 * nginx-rtmp fires this when publisher disconnects.
 *
 * Multi-tenant note: Phase 3.4 inserts a new streams row per go-live, so
 * we must match on (key_hash, is_live=true) to find the active row instead
 * of just the most-recent. Tie-break: most-recent `created_at`.
 */
/**
 * Which rung decides the broadcast is over.
 *
 * nginx fires this once per rung, so something has to say which one means "off
 * air". It is the lowest rung, on purpose: it is the cheapest to sustain and
 * therefore the last to fall over. Choosing the top rung would take the channel
 * off the site the moment a congested uplink dropped 720p, while 480p and 360p
 * were still going out perfectly well.
 *
 * The trade is the opposite case, where `_low` dies alone and the broadcast is
 * marked ended while higher rungs continue. That is the rarer failure, and it
 * fails toward "we stopped showing a stream that was still up" rather than
 * "we kept advertising a stream that was gone".
 */
const CONTROLLING_SUFFIX = "_low";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const publishName = params.get("name") ?? "";
  /*
   * Read the key the same way `on-publish` does.
   *
   * This hashed `name` alone. Since publishing moved to `<streamId>?key=<secret>`
   * the name is a public id, not the key, so the hash matched nothing and every
   * broadcast that ended left its row `is_live = true` forever.
   */
  const queryKey = params.get("key");
  const streamKey = queryKey || publishName;
  if (!streamKey) return new NextResponse("Missing stream key", { status: 400 });

  // A rung that does not control the live flag is acknowledged and ignored.
  const isLadder = HLS_VARIANT_SUFFIXES.some((s) => publishName.endsWith(s));
  if (isLadder && !publishName.endsWith(CONTROLLING_SUFFIX)) {
    return new NextResponse("OK", { status: 200 });
  }

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
