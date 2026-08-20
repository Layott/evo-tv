import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { deleteMessage, getMessageById } from "@/lib/api/chat";
import { activeSanctions } from "@/lib/sanctions";

/**
 * POST /api/streams/[id]/chat/[messageId]/ban
 *
 * The ban button inside the chat itself. It used to post `{ action: "ban" }`
 * at the partner channel endpoint, passing the stream id where that route
 * wants a channel id, and that route has no "ban" action: it has "timeout",
 * which only emits an event and persists nothing, so a banned viewer was back
 * the moment they reloaded.
 *
 * This writes the same `chat_banned` sanction the moderation queue writes, so
 * one list shows every ban, `isChatBlocked` enforces it on the next message,
 * and it expires by itself. The reported message goes with it, because leaving
 * it up is never what the person clicking ban meant.
 */

const bodySchema = z.object({
  /** Omitted means a day, which is what the button offers. */
  hours: z.number().int().min(1).max(24 * 365).default(24),
  reason: z.string().min(1).max(500).default("Banned from chat by a moderator"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const { id: streamId, messageId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { hours, reason } = parsed.data;

  const message = await getMessageById(messageId);
  if (!message || message.streamId !== streamId) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (message.userId === guard.user.id) {
    return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 });
  }

  const target = (
    await db
      .select({ id: schema.user.id, role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, message.userId))
      .limit(1)
  )[0];
  if (!target) {
    return NextResponse.json({ error: "That account no longer exists" }, { status: 404 });
  }

  // The same rank rule the sanction endpoint applies, so the chat cannot be
  // used as a side door to ban somebody the moderation screen would refuse.
  const targetRole = target.role ?? "user";
  if (
    targetRole === "head_admin" ||
    (targetRole === "admin" && guard.role !== "head_admin")
  ) {
    return NextResponse.json(
      { error: `Cannot ban ${targetRole === "head_admin" ? "a head admin" : "an admin"}` },
      { status: 403 },
    );
  }

  const already = (await activeSanctions(target.id)).find(
    (s) => s.kind === "chat_banned",
  );
  if (already) {
    return NextResponse.json(
      { error: "That person is already banned from chat" },
      { status: 409 },
    );
  }

  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + hours * 3_600_000).toISOString();
  await db.insert(schema.userSanctions).values({
    id: "san_" + crypto.randomBytes(8).toString("hex"),
    userId: target.id,
    kind: "chat_banned",
    reason,
    issuedBy: guard.user.id,
    expiresAt,
    revertedAt: null,
    revertedBy: null,
    createdAt: new Date(nowMs).toISOString(),
  });

  // deleteMessage publishes its own `deleted` frame, so every viewer sees the
  // line go, not just the moderator who clicked.
  await deleteMessage(messageId);

  void writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "community",
    action: "chat.ban",
    targetType: "user",
    targetId: target.id,
    meta: { streamId, messageId, hours, expiresAt, reason },
  });

  return NextResponse.json({ ok: true, expiresAt });
}
