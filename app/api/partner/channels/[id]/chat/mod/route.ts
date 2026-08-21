import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requirePublisherRoleByChannel } from "@/lib/auth/guards";
import { deleteMessage, pinMessage } from "@/lib/api/chat";
import { emit } from "@/lib/sse/bus";
import { writeAudit } from "@/lib/api/audit";

/**
 * POST /api/partner/channels/[id]/chat/mod
 *   body { action: "pin" | "delete" | "timeout", messageId?, userId?, durationSec? }
 *
 * Auth: editor or higher on the channel's publisher, or EVO admin.
 */

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pin"), messageId: z.string().min(1) }),
  z.object({ action: z.literal("delete"), messageId: z.string().min(1) }),
  z.object({
    action: z.literal("timeout"),
    userId: z.string().min(1),
    durationSec: z.number().int().min(10).max(86400),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: channelId } = await params;
  const guard = await requirePublisherRoleByChannel(channelId, "editor");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { action } = parsed.data;

  if (action === "pin") {
    const result = await pinMessage(parsed.data.messageId);
    if (!result) return new NextResponse("Message not found", { status: 404 });
    void writeAudit({
      actorId: guard.user.id,
      action: "update",
      targetType: "stream",
      targetId: channelId,
      before: { isPinned: !result.isPinned },
      after: { isPinned: result.isPinned },
      meta: { event: "chat_pin", messageId: parsed.data.messageId },
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "delete") {
    const deleted = await deleteMessage(parsed.data.messageId);
    if (!deleted) return new NextResponse("Message not found", { status: 404 });
    void writeAudit({
      actorId: guard.user.id,
      action: "delete",
      targetType: "stream",
      targetId: channelId,
      // The words go with the message. This is where they survive.
      before: { body: deleted.body, isDeleted: false },
      after: { body: deleted.body, isDeleted: true },
      meta: { event: "chat_delete", messageId: parsed.data.messageId },
    });
    return NextResponse.json({ ok: true });
  }

  // timeout: emit a transient mod event. Persistent ban table is Phase 5+.
  // Confirm the user exists so callers get a useful error.
  const target = (
    await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, parsed.data.userId))
      .limit(1)
  )[0];
  if (!target) return new NextResponse("User not found", { status: 404 });

  const expiresAt = new Date(Date.now() + parsed.data.durationSec * 1000).toISOString();
  emit(`stream:${channelId}:chat`, {
    type: "timeout",
    userId: parsed.data.userId,
    expiresAt,
  });
  void writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "stream",
    targetId: channelId,
    before: { timedOut: false },
    after: { timedOut: true, durationSec: parsed.data.durationSec, expiresAt },
    meta: {
      event: "chat_timeout",
      userId: parsed.data.userId,
      durationSec: parsed.data.durationSec,
      expiresAt,
    },
  });
  return NextResponse.json({ ok: true, expiresAt });
}
