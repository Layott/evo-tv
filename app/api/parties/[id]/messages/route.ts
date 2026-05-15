import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { isChatBlocked } from "@/lib/sanctions";
import { emit } from "@/lib/sse/bus";

const bodySchema = z.object({
  body: z.string().min(1).max(500),
});

function genId(): string {
  return (
    "msg_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * GET /api/parties/[id]/messages — list last 100 messages.
 *
 * Requires the caller to be an active member of the party.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;

  const isMember = (
    await db
      .select({ userId: schema.partyMembers.userId })
      .from(schema.partyMembers)
      .where(
        and(
          eq(schema.partyMembers.partyId, id),
          eq(schema.partyMembers.userId, user.id),
          isNull(schema.partyMembers.leftAt),
        ),
      )
      .limit(1)
  )[0];
  if (!isMember) {
    return new NextResponse("Not a member", { status: 403 });
  }

  const rows = await db
    .select({
      id: schema.partyMessages.id,
      partyId: schema.partyMessages.partyId,
      userId: schema.partyMessages.userId,
      body: schema.partyMessages.body,
      isSystem: schema.partyMessages.isSystem,
      createdAt: schema.partyMessages.createdAt,
      userName: schema.user.name,
      userHandle: schema.user.handle,
      userAvatarUrl: schema.user.image,
    })
    .from(schema.partyMessages)
    .leftJoin(schema.user, eq(schema.user.id, schema.partyMessages.userId))
    .where(eq(schema.partyMessages.partyId, id))
    .orderBy(desc(schema.partyMessages.createdAt))
    .limit(100);

  return NextResponse.json(rows.reverse());
}

/**
 * POST /api/parties/[id]/messages — append a message + broadcast SSE.
 *
 * Caller must be an active member. 500-char limit. Emits to topic
 * `party:<id>:chat`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  if (await isChatBlocked(user.id)) {
    return NextResponse.json(
      { error: "You are banned from chat" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const isMember = (
    await db
      .select({ userId: schema.partyMembers.userId })
      .from(schema.partyMembers)
      .where(
        and(
          eq(schema.partyMembers.partyId, id),
          eq(schema.partyMembers.userId, user.id),
          isNull(schema.partyMembers.leftAt),
        ),
      )
      .limit(1)
  )[0];
  if (!isMember) {
    return new NextResponse("Not a member", { status: 403 });
  }

  const msgId = genId();
  await db.insert(schema.partyMessages).values({
    id: msgId,
    partyId: id,
    userId: user.id,
    body: parsed.data.body,
    isSystem: false,
  });

  const profile = (
    await db
      .select({
        name: schema.user.name,
        handle: schema.user.handle,
        image: schema.user.image,
      })
      .from(schema.user)
      .where(eq(schema.user.id, user.id))
      .limit(1)
  )[0];

  const payload = {
    type: "message" as const,
    message: {
      id: msgId,
      partyId: id,
      userId: user.id,
      body: parsed.data.body,
      isSystem: false,
      createdAt: new Date().toISOString(),
      userName: profile?.name ?? null,
      userHandle: profile?.handle ?? null,
      userAvatarUrl: profile?.image ?? null,
    },
  };

  emit(`party:${id}:chat`, payload);

  return NextResponse.json(payload.message);
}
