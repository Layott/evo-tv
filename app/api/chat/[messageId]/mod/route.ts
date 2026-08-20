import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { deleteMessage, getMessageById, pinMessage } from "@/lib/api/chat";
import { activeSanctions } from "@/lib/sanctions";

/**
 * POST /api/chat/[messageId]/mod   { action: "pin" | "delete" | "ban", hours? }
 *
 * Moderation addressed by the message rather than by where it lives.
 *
 * The old routes were nested under a stream, which stopped being true the day
 * chat appeared under a recording: the same three buttons would have needed a
 * second set of endpoints and a client that knew which kind of page it was on.
 * A message knows where it lives; nothing else has to.
 */

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pin") }),
  z.object({ action: z.literal("delete") }),
  z.object({
    action: z.literal("ban"),
    hours: z.number().int().min(1).max(24 * 365).default(24),
    reason: z.string().min(1).max(500).optional(),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const { messageId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const message = await getMessageById(messageId);
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const where = message.streamId
    ? { targetType: "stream" as const, targetId: message.streamId }
    : { targetType: "vod" as const, targetId: message.vodId ?? "" };

  if (parsed.data.action === "pin") {
    const result = await pinMessage(messageId);
    if (!result) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    void writeAudit({
      actorId: guard.user.id,
      actorRole: guard.role,
      capability: "moderation",
      action: result.isPinned ? "chat.pin" : "chat.unpin",
      ...where,
      meta: { messageId },
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (parsed.data.action === "delete") {
    const deleted = await deleteMessage(messageId);
    if (!deleted) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    void writeAudit({
      actorId: guard.user.id,
      actorRole: guard.role,
      capability: "moderation",
      action: "chat.delete",
      ...where,
      meta: { messageId, body: deleted.body },
    });
    return NextResponse.json({ ok: true });
  }

  // ban
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

  const targetRole = target.role ?? "user";
  if (targetRole === "head_admin" || (targetRole === "admin" && guard.role !== "head_admin")) {
    return NextResponse.json(
      { error: `Cannot ban ${targetRole === "head_admin" ? "a head admin" : "an admin"}` },
      { status: 403 },
    );
  }

  if ((await activeSanctions(target.id)).some((s) => s.kind === "chat_banned")) {
    return NextResponse.json(
      { error: "That person is already banned from chat" },
      { status: 409 },
    );
  }

  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + parsed.data.hours * 3_600_000).toISOString();
  await db.insert(schema.userSanctions).values({
    id: "san_" + crypto.randomBytes(8).toString("hex"),
    userId: target.id,
    kind: "chat_banned",
    reason: parsed.data.reason ?? "Banned from chat by a moderator",
    issuedBy: guard.user.id,
    expiresAt,
    revertedAt: null,
    revertedBy: null,
    createdAt: new Date(nowMs).toISOString(),
  });

  // The offending message goes with the ban; leaving it up is never what the
  // person pressing ban meant.
  await deleteMessage(messageId);

  void writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "moderation",
    action: "chat.ban",
    targetType: "user",
    targetId: target.id,
    meta: { messageId, hours: parsed.data.hours, expiresAt, ...where },
  });

  return NextResponse.json({ ok: true, expiresAt });
}
