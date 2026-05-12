import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq, isNull } from "drizzle-orm";
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
  // List public + active parties + ones I'm a member of (host or member).
  const rows = await db
    .select()
    .from(schema.parties)
    .where(isNull(schema.parties.endedAt))
    .limit(50);
  return NextResponse.json(
    rows.filter((p) => !p.isPrivate || p.hostUserId === user.id),
  );
}
