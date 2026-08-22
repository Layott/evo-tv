import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { locateIp } from "@/lib/geo/ip-location";
import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStreamById } from "@/lib/api/streams";
import { join, leave, presenceTopic } from "@/lib/sse/presence";
import { resolveClientInfo } from "@/lib/analytics/client-info";
import { HLS_VARIANT_SUFFIXES } from "@/lib/video/rungs";

/**
 * Viewer-minute heartbeat. Called once per 60s by the live player while a
 * stream is being watched. Idempotent per (channelId, viewerKey, minute_bucket)
 * so duplicate pings within the same minute are coalesced.
 *
 *   minute_bucket   ISO-8601 truncated to minute: 2026-05-12T14:23:00.000Z
 *   viewerKey       userId if signed in; otherwise sha256(ip) for anon
 *
 * Each row is one minute of attention for a channel. Aggregated nightly
 * into analytics_daily.watch_minutes + analytics_daily.unique_viewers.
 */

function generateId(): string {
  return (
    "we_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function minuteBucket(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString();
}

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

function hashIp(req: NextRequest): string {
  return crypto
    .createHash("sha256")
    .update(clientIp(req) ?? "unknown")
    .digest("hex")
    .slice(0, 32);
}

/**
 * The ladder rung the player reported. Anything else is recorded as null.
 *
 * `_fhd` was missing from this list, so a viewer on 1080p, the most expensive
 * rung there is and the only one behind a subscription, recorded as though the
 * player had said nothing at all.
 */
function rungFrom(value: unknown): string | null {
  return HLS_VARIANT_SUFFIXES.includes(value as (typeof HLS_VARIANT_SUFFIXES)[number])
    ? (value as string)
    : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: streamId } = await params;

  const stream = await getStreamById(streamId);
  if (!stream) return new NextResponse("Stream not found", { status: 404 });

  const user = await getCurrentUser();
  const ipHash = hashIp(req);
  // The viewer key is the same one liveViewerCounts() counts distinct on, so
  // the control room and the public page can never report different numbers.
  const viewerKey = user?.id ?? ipHash;
  const topic = presenceTopic(streamId);

  // Presence first, and on every beat rather than only on the first: it is one
  // ZADD, and it is what refreshes this viewer's score so they do not age out.
  await join(topic, viewerKey);

  if (!stream.channelId) {
    // Not bound to a channel, so there is no analytics row to write, but the
    // viewer is still watching and still belongs in the count.
    return NextResponse.json({ ok: true, accounted: false });
  }

  const bucket = minuteBucket();
  const channelId = stream.channelId;

  /*
   * Which country the viewer is in.
   *
   * The website is proxied and so carries `cf-ipcountry`. The app talks to
   * api.evotv.co, which is not proxied, so it carries nothing and every app
   * viewer landed in the audience breakdown with no country beside a website
   * viewer who had one. The lookup covers that, and is cached per address, so
   * a viewer sending a heartbeat every fifteen seconds is one lookup a day.
   */
  const headerCountry = (req.headers.get("cf-ipcountry") ?? "").slice(0, 2).toUpperCase();
  const country =
    headerCountry && headerCountry !== "XX"
      ? headerCountry
      // No `remote`: this row stores the country and nothing finer, and the
      // local file supplies a country for effectively every address, so a
      // paid call here would buy something already in hand.
      : ((await locateIp(clientIp(req)))?.country ?? "");

  /*
   * What the viewer is watching on.
   *
   * A user agent is all a browser will admit to, and it is worse than nothing
   * for the app: a React Native agent parses as neither a phone nor a browser,
   * so every app viewer was filed under Unknown in the audience breakdown while
   * the app is the surface most people watch on. The app knows its own
   * platform, model, OS and build, so it says so, and this trusts it.
   *
   * A beat with no body at all is still a beat. An old app build sends one, and
   * a viewer running it must keep counting.
   */
  let rung: string | null = null;
  let reported: Record<string, unknown> | null = null;
  try {
    reported = (await req.json()) as Record<string, unknown>;
    rung = rungFrom(reported?.rung);
  } catch {
    reported = null;
  }
  const client = resolveClientInfo(reported, req.headers.get("user-agent") ?? "");

  // Dedup within bucket: if a row already exists for this channel+bucket and
  // this viewer (by user_id if signed in, otherwise by ip_hash), skip insert.
  const existing = (
    await db
      .select({ id: schema.watchEvents.id })
      .from(schema.watchEvents)
      .where(
        and(
          eq(schema.watchEvents.channelId, channelId),
          eq(schema.watchEvents.minuteBucket, bucket),
          user
            ? eq(schema.watchEvents.userId, user.id)
            : eq(schema.watchEvents.ipHash, ipHash),
        ),
      )
      .limit(1)
  )[0];

  if (existing) {
    return NextResponse.json({ ok: true, accounted: false, deduped: true });
  }

  await db.insert(schema.watchEvents).values({
    id: generateId(),
    channelId,
    streamId,
    userId: user?.id ?? null,
    minuteBucket: bucket,
    ipHash: user ? "" : ipHash,
    country: country === "XX" ? null : country || null,
    device: client.device,
    rung,
    platform: client.platform,
    model: client.model,
    osName: client.osName,
    osVersion: client.osVersion,
    appVersion: client.appVersion,
  });

  return NextResponse.json({ ok: true, accounted: true });
}

/**
 * DELETE /api/streams/[id]/heartbeat - viewer is leaving.
 *
 * Drops the caller's watch_events rows for this stream within the active
 * read-window (last 90s) so the read-time count tick drops to N-1 right
 * away instead of waiting for the row to age out.
 *
 * Fire from the RN cleanup of useStreamHeartbeat.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: streamId } = await params;
  const user = await getCurrentUser();
  const ipHash = hashIp(req);

  // Drop them from the count now rather than making an operator wait out the
  // stale window for somebody who left politely.
  await leave(presenceTopic(streamId), user?.id ?? ipHash);

  const cutoff = new Date(Date.now() - 90_000).toISOString();
  await db.delete(schema.watchEvents).where(
    and(
      eq(schema.watchEvents.streamId, streamId),
      user
        ? eq(schema.watchEvents.userId, user.id)
        : eq(schema.watchEvents.ipHash, ipHash),
      // Only drop recent rows - never historical analytics.
      // (drizzle gte on text-stored timestamps compares lexically; ISO 8601
      // is lex-sortable so this is fine.)
      gte(schema.watchEvents.createdAt, cutoff),
    ),
  );
  return NextResponse.json({ ok: true });
}
