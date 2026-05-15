import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { emit } from "@/lib/sse/bus";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const party = (
    await db
      .select()
      .from(schema.parties)
      .where(eq(schema.parties.id, id))
      .limit(1)
  )[0];
  if (!party) return new NextResponse("Not found", { status: 404 });

  const activeMembersRow = (
    await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.partyMembers)
      .where(
        and(
          eq(schema.partyMembers.partyId, id),
          isNull(schema.partyMembers.leftAt),
        ),
      )
  )[0];

  const host = (
    await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        handle: schema.user.handle,
        image: schema.user.image,
      })
      .from(schema.user)
      .where(eq(schema.user.id, party.hostUserId))
      .limit(1)
  )[0];

  const stream = party.streamId
    ? (
        await db
          .select({
            id: schema.streams.id,
            title: schema.streams.title,
            thumbnailUrl: schema.streams.thumbnailUrl,
            streamerName: schema.streams.streamerName,
          })
          .from(schema.streams)
          .where(eq(schema.streams.id, party.streamId))
          .limit(1)
      )[0]
    : null;

  const memberRows = await db
    .select({
      userId: schema.partyMembers.userId,
      joinedAt: schema.partyMembers.joinedAt,
      name: schema.user.name,
      handle: schema.user.handle,
      avatarUrl: schema.user.image,
    })
    .from(schema.partyMembers)
    .leftJoin(schema.user, eq(schema.user.id, schema.partyMembers.userId))
    .where(
      and(
        eq(schema.partyMembers.partyId, id),
        isNull(schema.partyMembers.leftAt),
      ),
    );

  return NextResponse.json({
    ...party,
    activeMembers: activeMembersRow?.n ?? 0,
    host: host ?? null,
    stream,
    members: memberRows.map((m) => ({
      ...m,
      isHost: m.userId === party.hostUserId,
    })),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;
  const party = (
    await db
      .select({ hostUserId: schema.parties.hostUserId })
      .from(schema.parties)
      .where(eq(schema.parties.id, id))
      .limit(1)
  )[0];
  if (!party) return new NextResponse("Not found", { status: 404 });
  if (party.hostUserId !== user.id) {
    return new NextResponse("Only host can end party", { status: 403 });
  }
  await db
    .update(schema.parties)
    .set({ endedAt: new Date().toISOString() })
    .where(eq(schema.parties.id, id));
  emit(`party:${id}:ended`, { id, at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
