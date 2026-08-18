import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { hashStreamKey } from "@/lib/video/stream-key";
import { emit } from "@/lib/sse/bus";
import "@/workers/transcode";
import { baseStreamName, rtmpHlsUrlFor } from "@/lib/video/ingest";
import { slugForStream } from "@/lib/api/slugs";

/**
 * Concurrent-stream cap per publisher. Hardcoded MVP tiers - replace with
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
  /*
   * The publish name is public; the key is not.
   *
   * nginx-rtmp names its HLS output after the RTMP stream name, so when the
   * name WAS the key, the public playback URL read `/hls/<STREAM_KEY>.m3u8`
   * and every viewer was handed the credential needed to broadcast as us,
   * visible in devtools.
   *
   * OBS now publishes to `<streamId>?key=<secret>`. nginx-rtmp forwards query
   * arguments to this callback, so the key still authenticates the publish, it
   * simply no longer names the output. Playback becomes
   * `/hls/<streamId>.m3u8`, which is a public identifier.
   *
   * `name` is accepted as the key too, for a broadcaster still configured the
   * old way. That path is deprecated: it works, and it leaks the key into
   * every viewer's network tab, so rotate onto the new form.
   */
  const publishName = params.get("name") ?? "";
  /*
   * One broadcast, three publishes.
   *
   * The encoder sends a stream per quality rung, so this callback fires once
   * for `<streamId>_low`, once for `_mid` and once for `_hi`. Everything below
   * cares about the broadcast, not the rung: the playback URL must be the
   * master playlist nginx writes under the base name, and three publishes must
   * not become three streams in the schedule.
   */
  const baseName = baseStreamName(publishName);
  const hlsUrl = rtmpHlsUrlFor(baseName);
  const queryKey = params.get("key");
  const streamKey = queryKey || publishName;
  if (!streamKey) return new NextResponse("Missing stream key", { status: 400 });
  const keyIsInName = !queryKey;

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

    /*
     * A second or third rung of a broadcast already on air is not a new
     * broadcast. Without this the ladder would create three streams for one
     * show: three rows in the schedule, three live badges, and three entries
     * counting against the publisher's concurrent cap.
     *
     * Matching on the master playlist URL is what makes the rungs collapse
     * together, since all three resolve to the same base name.
     */
    const alreadyLive = (
      await db
        .select({ id: schema.streams.id })
        .from(schema.streams)
        .where(
          and(
            eq(schema.streams.channelId, channel.id),
            eq(schema.streams.hlsPath, hlsUrl),
            eq(schema.streams.isLive, true),
          ),
        )
        .limit(1)
    )[0];
    if (alreadyLive) return new NextResponse("OK", { status: 200 });

    const streamId = generateStreamId();
    await db.insert(schema.streams).values({
      id: streamId,
      title: `${channel.name} live`,
      slug: await slugForStream(`${channel.name} live`),
      description: "",
      // Null, not Free Fire. This hardcoded a game onto every channel that
      // published, so an anime or lifestyle broadcast carried an esports badge.
      gameId: null,
      channelId: channel.id,
      streamerType: "creator",
      streamerName: channel.name,
      streamerAvatarUrl: channel.logoUrl,
      streamKeyHash: keyHash,
      isLive: true,
      startedAt: nowIso,
      endedAt: null,
      feedLostAt: null,
      hlsPath: hlsUrl,
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

  /*
   * 2. Stream-owned key: a `streams` row whose `stream_key_hash` matches.
   *
   * This was labelled "legacy, remove once every channel has a key row". It is
   * not legacy: it is the path every stream created through
   * `POST /api/admin/streams` takes, because that route issues a key onto the
   * stream row rather than into `channel_stream_keys`. Deleting this branch
   * would break self-hosted ingest completely.
   *
   * The two paths answer different questions. `channel_stream_keys` is a
   * standing key for a channel, and a publish on it creates a new stream. This
   * one is a key for one specific programme an operator has already scheduled.
   */
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
      // An encoder that drops and reconnects publishes again within seconds.
      // Overwriting startedAt each time would reset the broadcast clock and
      // make "on air 2h" read "on air 4s" after a blip.
      startedAt: legacy.startedAt ?? nowIso,
      endedAt: null,
      /*
       * The feed is back, so the reconnect clock stops.
       *
       * `offlineByOperator` clears too: an encoder publishing again is a
       * deliberate act, and leaving the flag set would stop the reconciler
       * ever reviving this stream after a genuine drop later on.
       */
      feedLostAt: null,
      offlineByOperator: false,
      hlsPath: hlsUrl,
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
