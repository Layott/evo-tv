import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStreamById } from "@/lib/api/streams";
import { join, leave, presenceTopic } from "@/lib/sse/presence";

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

function hashIp(req: NextRequest): string {
  const fwd =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return crypto.createHash("sha256").update(fwd).digest("hex").slice(0, 32);
}

/** Coarse enough to be a useful cut, coarse enough not to identify anybody. */
function deviceFrom(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone/.test(s)) return "mobile";
  if (/smart-?tv|smarttv|appletv|googletv|hbbtv|netcast|webos|tizen/.test(s)) return "tv";
  if (!s) return "";
  return "desktop";
}

/** The ladder rung the player reported. Anything else is recorded as null. */
function rungFrom(value: unknown): string | null {
  return value === "_low" || value === "_mid" || value === "_hi" ? value : null;
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

  const country = (req.headers.get("cf-ipcountry") ?? "").slice(0, 2).toUpperCase();
  const device = deviceFrom(req.headers.get("user-agent") ?? "");
  let rung: string | null = null;
  try {
    const body = (await req.json()) as { rung?: unknown };
    rung = rungFrom(body?.rung);
  } catch {
    // The app sends no body at all. That is fine and must not fail the beat.
  }

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
    device: device || null,
    rung,
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
