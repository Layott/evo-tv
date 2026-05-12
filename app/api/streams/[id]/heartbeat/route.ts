import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStreamById } from "@/lib/api/streams";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: streamId } = await params;

  const stream = await getStreamById(streamId);
  if (!stream) return new NextResponse("Stream not found", { status: 404 });
  if (!stream.channelId) {
    // Stream not bound to a channel — accept silently. Backfill orphan.
    return NextResponse.json({ ok: true, accounted: false });
  }

  const user = await getCurrentUser();
  const ipHash = hashIp(req);
  const bucket = minuteBucket();
  const channelId = stream.channelId;

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
  });

  return NextResponse.json({ ok: true, accounted: true });
}
