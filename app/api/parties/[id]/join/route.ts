import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { emit } from "@/lib/sse/bus";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;

  const party = (
    await db
      .select()
      .from(schema.parties)
      .where(eq(schema.parties.id, id))
      .limit(1)
  )[0];
  if (!party) return new NextResponse("Not found", { status: 404 });
  if (party.endedAt) return new NextResponse("Party ended", { status: 410 });

  if (party.isPrivate) {
    const body = (await req.json().catch(() => null)) as
      | { inviteCode?: string }
      | null;
    if (!body?.inviteCode || body.inviteCode !== party.inviteCode) {
      return new NextResponse("Invalid invite code", { status: 403 });
    }
  }

  const count = (
    await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.partyMembers)
      .where(
        and(
          eq(schema.partyMembers.partyId, id),
          isNull(schema.partyMembers.leftAt),
        ),
      )
  )[0]?.n ?? 0;
  if (count >= party.maxMembers) {
    return new NextResponse("Party full", { status: 409 });
  }

  // Upsert: if user previously left, reset leftAt to null.
  await db
    .insert(schema.partyMembers)
    .values({ partyId: id, userId: user.id })
    .onConflictDoUpdate({
      target: [schema.partyMembers.partyId, schema.partyMembers.userId],
      set: { leftAt: null, joinedAt: new Date().toISOString() },
    });

  emit(`party:${id}:presence`, {
    type: "joined",
    userId: user.id,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
