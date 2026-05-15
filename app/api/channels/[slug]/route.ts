import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * GET /api/channels/[slug] — public channel page payload.
 *   channel, live stream (if any), recent VODs, follower-state-for-caller.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const channel = (
    await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.slug, slug))
      .limit(1)
  )[0];
  if (!channel) return new NextResponse("Channel not found", { status: 404 });

  // Suspended channels are hidden from the public — admins can still reach
  // them via /api/admin/channels.
  if (channel.suspendedAt) {
    return new NextResponse("Channel not found", { status: 404 });
  }

  const liveStreams = await db
    .select()
    .from(schema.streams)
    .where(
      and(
        eq(schema.streams.channelId, channel.id),
        eq(schema.streams.isLive, true),
      ),
    )
    .orderBy(desc(schema.streams.startedAt))
    .limit(1);

  const recentVods = await db
    .select({
      id: schema.vods.id,
      title: schema.vods.title,
      durationSec: schema.vods.durationSec,
      thumbnailUrl: schema.vods.thumbnailUrl,
      publishedAt: schema.vods.publishedAt,
      viewCount: schema.vods.viewCount,
      likeCount: schema.vods.likeCount,
    })
    .from(schema.vods)
    .where(eq(schema.vods.channelId, channel.id))
    .orderBy(desc(schema.vods.publishedAt))
    .limit(12);

  let followedByMe = false;
  const user = await getCurrentUser();
  if (user) {
    const row = (
      await db
        .select({ userId: schema.channelFollowers.userId })
        .from(schema.channelFollowers)
        .where(
          and(
            eq(schema.channelFollowers.channelId, channel.id),
            eq(schema.channelFollowers.userId, user.id),
          ),
        )
        .limit(1)
    )[0];
    followedByMe = !!row;
  }

  return NextResponse.json({
    channel,
    liveStream: liveStreams[0] ?? null,
    recentVods,
    followedByMe,
  });
}
