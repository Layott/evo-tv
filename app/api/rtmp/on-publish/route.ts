import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { hashStreamKey } from "@/lib/video/stream-key";
import { emit } from "@/lib/sse/bus";
import "@/workers/transcode";

/**
 * Concurrent-stream cap per publisher. Hardcoded MVP tiers — replace with
 * a publishers.concurrent_stream_cap column once partner tier table lands.
 */
const CONCURRENT_CAP_EVOTV = 999;
const CONCURRENT_CAP_PARTNER = 3;

/**
 * Invoked by nginx-rtmp on RTMP publish start.
 * nginx posts form-urlencoded: `name=<stream_key>&app=live&addr=<ip>`.
 * Must respond 2xx to allow publish; any non-2xx rejects the connection.
 *
 * Multi-tenant lookup (Phase 3.4):
 *   1. Hash incoming `name` and look up `channel_stream_keys` WHERE
 *      key_hash matches AND active=true.
 *   2. INSERT a new `streams` row tied to channel_id (replaces the old
 *      "must pre-exist a streams row" rule).
 *   3. Emit channel:<id>:live for partner dashboards + global
 *      stream:live-now feed.
 *
 * Legacy fallback: if no channel_stream_keys match, fall back to the
 * pre-3.4 lookup against `streams.stream_key_hash` so the EVO TV-owned
 * channels seeded before key rotation still work during the transition.
 * Remove the fallback once every channel has a key in
 * channel_stream_keys.
 */

function generateStreamId(): string {
  return (
    "stream_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const streamKey = params.get("name");
  if (!streamKey) return new NextResponse("Missing stream key", { status: 400 });

  const keyHash = hashStreamKey(streamKey);
  const nowIso = new Date().toISOString();

  // 1. Multi-tenant path: channel_stream_keys
  const channelKeyRow = (
    await db
      .select({
        channelId: schema.channelStreamKeys.channelId,
        active: schema.channelStreamKeys.active,
      })
      .from(schema.channelStreamKeys)
      .where(
        and(
          eq(schema.channelStreamKeys.keyHash, keyHash),
          eq(schema.channelStreamKeys.active, true),
        ),
      )
      .limit(1)
  )[0];

  if (channelKeyRow) {
    const channel = (
      await db
        .select({
          id: schema.channels.id,
          name: schema.channels.name,
          logoUrl: schema.channels.logoUrl,
          category: schema.channels.category,
          publisherId: schema.channels.publisherId,
          suspendedAt: schema.channels.suspendedAt,
        })
        .from(schema.channels)
        .where(eq(schema.channels.id, channelKeyRow.channelId))
        .limit(1)
    )[0];

    if (!channel) {
      return new NextResponse("Channel missing for stream key", { status: 500 });
    }
    if (channel.suspendedAt) {
      return new NextResponse("Channel suspended", { status: 403 });
    }

    // Concurrent stream cap per publisher. Count existing live streams
    // tied to any channel owned by this publisher.
    const pub = (
      await db
        .select({ isEvotvOwned: schema.publishers.isEvotvOwned })
        .from(schema.publishers)
        .where(eq(schema.publishers.id, channel.publisherId))
        .limit(1)
    )[0];
    const cap = pub?.isEvotvOwned
      ? CONCURRENT_CAP_EVOTV
      : CONCURRENT_CAP_PARTNER;

    const liveCountRow = (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.streams)
        .innerJoin(
          schema.channels,
          eq(schema.channels.id, schema.streams.channelId),
        )
        .where(
          and(
            eq(schema.channels.publisherId, channel.publisherId),
            eq(schema.streams.isLive, true),
          ),
        )
    )[0];
    const live = liveCountRow?.n ?? 0;
    if (live >= cap) {
      return new NextResponse(
        `Concurrent stream cap reached (${live}/${cap}) for publisher`,
        { status: 429 },
      );
    }

    const streamId = generateStreamId();
    await db.insert(schema.streams).values({
      id: streamId,
      title: `${channel.name} live`,
      description: "",
      gameId: "game_freefire",
      channelId: channel.id,
      streamerType: "creator",
      streamerName: channel.name,
      streamerAvatarUrl: channel.logoUrl,
      streamKeyHash: keyHash,
      isLive: true,
      startedAt: nowIso,
      endedAt: null,
      hlsPath: `/hls/${streamKey}.m3u8`,
      viewerCount: 0,
      peakViewerCount: 0,
      language: "en",
      tags: [],
      isPremium: false,
      createdAt: nowIso,
    });

    emit(`stream:${streamId}:status`, { isLive: true, startedAt: nowIso });
    emit(`channel:${channel.id}:live`, { streamId, channelId: channel.id });
    emit("stream:live-now", { streamId, channelId: channel.id });

    return new NextResponse("OK", { status: 200 });
  }

  // 2. Legacy path: pre-existing streams row keyed by stream_key_hash.
  // Phase 3 transition only. Remove once every active channel has a key row.
  const legacy = (
    await db
      .select()
      .from(schema.streams)
      .where(eq(schema.streams.streamKeyHash, keyHash))
      .limit(1)
  )[0];

  if (!legacy) return new NextResponse("Unknown stream key", { status: 403 });

  await db
    .update(schema.streams)
    .set({
      isLive: true,
      startedAt: nowIso,
      endedAt: null,
      hlsPath: `/hls/${streamKey}.m3u8`,
      viewerCount: 0,
    })
    .where(eq(schema.streams.id, legacy.id));

  emit(`stream:${legacy.id}:status`, { isLive: true, startedAt: nowIso });
  if (legacy.channelId) {
    emit(`channel:${legacy.channelId}:live`, {
      streamId: legacy.id,
      channelId: legacy.channelId,
    });
  }
  emit("stream:live-now", { streamId: legacy.id, channelId: legacy.channelId ?? null });

  return new NextResponse("OK", { status: 200 });
}
