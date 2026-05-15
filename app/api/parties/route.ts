import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  streamId: z.string().min(1).max(128).optional(),
  maxMembers: z.number().int().min(2).max(100).default(20),
  isPrivate: z.boolean().default(false),
});

function genId(): string {
  return (
    "party_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function genInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const id = genId();
  const inviteCode = parsed.data.isPrivate ? genInviteCode() : null;
  await db.insert(schema.parties).values({
    id,
    name: parsed.data.name,
    hostUserId: user.id,
    streamId: parsed.data.streamId ?? null,
    maxMembers: parsed.data.maxMembers,
    isPrivate: parsed.data.isPrivate,
    inviteCode,
  });
  await db.insert(schema.partyMembers).values({
    partyId: id,
    userId: user.id,
  });
  return NextResponse.json({ id, inviteCode });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  // Active parties, joined with host + stream for display fields.
  const rows = await db
    .select({
      id: schema.parties.id,
      name: schema.parties.name,
      hostUserId: schema.parties.hostUserId,
      hostName: schema.user.name,
      hostHandle: schema.user.handle,
      hostAvatarUrl: schema.user.image,
      streamId: schema.parties.streamId,
      streamTitle: schema.streams.title,
      streamThumbnailUrl: schema.streams.thumbnailUrl,
      maxMembers: schema.parties.maxMembers,
      isPrivate: schema.parties.isPrivate,
      inviteCode: schema.parties.inviteCode,
      startedAt: schema.parties.startedAt,
    })
    .from(schema.parties)
    .leftJoin(schema.user, eq(schema.user.id, schema.parties.hostUserId))
    .leftJoin(schema.streams, eq(schema.streams.id, schema.parties.streamId))
    .where(isNull(schema.parties.endedAt))
    .limit(50);

  // Active member counts (one extra query for the listed IDs).
  const ids = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const countRows = await db
      .select({
        partyId: schema.partyMembers.partyId,
        n: sql<number>`count(*)::int`,
      })
      .from(schema.partyMembers)
      .where(
        and(
          isNull(schema.partyMembers.leftAt),
          inArray(schema.partyMembers.partyId, ids),
        ),
      )
      .groupBy(schema.partyMembers.partyId);
    for (const r of countRows) counts.set(r.partyId, Number(r.n));
  }

  // Hide invite codes from non-hosts. Filter out private parties not owned
  // by the caller.
  const enriched = rows
    .filter((p) => !p.isPrivate || p.hostUserId === user.id)
    .map((p) => ({
      ...p,
      activeMembers: counts.get(p.id) ?? 0,
      inviteCode: p.hostUserId === user.id ? p.inviteCode : null,
    }));

  return NextResponse.json(enriched);
}
