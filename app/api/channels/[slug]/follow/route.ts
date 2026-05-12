import { NextResponse, type NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * POST /api/channels/[slug]/follow — toggle. Idempotent in either
 * direction. Returns the new state + channel follower_count.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { slug } = await params;

  const channel = (
    await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(eq(schema.channels.slug, slug))
      .limit(1)
  )[0];
  if (!channel) return new NextResponse("Channel not found", { status: 404 });

  const existing = (
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

  if (existing) {
    await db
      .delete(schema.channelFollowers)
      .where(
        and(
          eq(schema.channelFollowers.channelId, channel.id),
          eq(schema.channelFollowers.userId, user.id),
        ),
      );
    await db
      .update(schema.channels)
      .set({ followerCount: sql`GREATEST(0, ${schema.channels.followerCount} - 1)` })
      .where(eq(schema.channels.id, channel.id));
    return NextResponse.json({ following: false });
  }

  await db.insert(schema.channelFollowers).values({
    channelId: channel.id,
    userId: user.id,
  });
  await db
    .update(schema.channels)
    .set({ followerCount: sql`${schema.channels.followerCount} + 1` })
    .where(eq(schema.channels.id, channel.id));
  return NextResponse.json({ following: true });
}
