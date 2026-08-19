import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { generateId } from "@/lib/api/admin";

/**
 * What the queue's four buttons mean.
 *
 * The screen has always sent `action`, and this route has always wanted
 * `status`, so every button answered 422 and the toast printed the validation
 * object as "[object Object]". Nothing in the moderation queue worked, and the
 * error said nothing about why.
 *
 * `status` is still accepted, because the bulk endpoint speaks it.
 */
const patchSchema = z
  .object({
    action: z.enum(["approve", "remove", "ban", "escalate"]).optional(),
    status: z.enum(["resolved", "dismissed"]).optional(),
    notes: z.string().max(2000).optional(),
    /** How long a ban lasts, in hours. Omitted means permanent. */
    banHours: z.number().int().min(1).max(24 * 365).optional(),
  })
  .refine((v) => v.action || v.status, {
    message: "Say what to do: action or status",
  });

/** Approving a report dismisses it: the thing reported was fine. */
const STATUS_FOR: Record<string, string> = {
  approve: "dismissed",
  remove: "resolved",
  ban: "resolved",
  escalate: "escalated",
};

/**
 * PATCH /api/admin/reports/[id]
 *
 * Resolve or dismiss a report. Sets resolvedBy/resolvedAt/resolutionNotes.
 * Once non-`open`, cannot be re-modified. Audits the action.
 *
 * Moderator+.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { action, notes, banHours } = parsed.data;
  const status = action ? STATUS_FOR[action]! : parsed.data.status!;

  const row = (
    await db
      .select()
      .from(schema.contentReports)
      .where(eq(schema.contentReports.id, id))
      .limit(1)
  )[0];
  if (!row) return new NextResponse("Report not found", { status: 404 });
  if (row.status !== "open") {
    return NextResponse.json(
      { error: `Report already ${row.status}` },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();

  /*
   * The side effects, which is the part that was missing entirely.
   *
   * Marking a report resolved does nothing to the message that was reported or
   * to the person who sent it, so "Delete message" and "Ban user" were labels
   * on a button that only closed the report.
   */
  let removedMessage = false;
  let bannedUserId: string | null = null;

  if (action === "remove" && row.targetType === "chat_message") {
    await db
      .update(schema.chatMessages)
      .set({ isDeleted: true })
      .where(eq(schema.chatMessages.id, row.targetId));
    removedMessage = true;
  }

  if (action === "ban") {
    // Who to ban: the author of the reported message, or the reported account
    // itself. Anything else has no person attached and the ban is refused
    // rather than guessed at.
    let targetUserId: string | null = null;
    if (row.targetType === "user") {
      targetUserId = row.targetId;
    } else if (row.targetType === "chat_message") {
      const msg = (
        await db
          .select({ userId: schema.chatMessages.userId })
          .from(schema.chatMessages)
          .where(eq(schema.chatMessages.id, row.targetId))
          .limit(1)
      )[0];
      targetUserId = msg?.userId ?? null;
      if (msg) {
        await db
          .update(schema.chatMessages)
          .set({ isDeleted: true })
          .where(eq(schema.chatMessages.id, row.targetId));
        removedMessage = true;
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        {
          error:
            "This report is not against a person, so there is nobody to ban. Delete the message instead.",
        },
        { status: 409 },
      );
    }

    await db.insert(schema.userSanctions).values({
      id: generateId("sanction"),
      userId: targetUserId,
      kind: "chat_ban",
      reason: notes?.trim() || `Report ${id}: ${row.category}`,
      issuedBy: guard.user.id,
      expiresAt: banHours
        ? new Date(Date.now() + banHours * 3_600_000).toISOString()
        : null,
      createdAt: nowIso,
    });
    bannedUserId = targetUserId;
  }

  await db
    .update(schema.contentReports)
    .set({
      status,
      resolvedBy: guard.user.id,
      resolvedAt: nowIso,
      resolutionNotes: notes ?? null,
    })
    .where(eq(schema.contentReports.id, id));

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "community",
    action: `report.${action ?? status}`,
    targetType: "report",
    targetId: id,
    before: { status: row.status },
    after: { status },
    meta: {
      reportTargetType: row.targetType,
      reportTargetId: row.targetId,
      category: row.category,
      notes,
      removedMessage,
      bannedUserId,
      banHours: banHours ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    reportId: id,
    status,
    removedMessage,
    bannedUserId,
  });
}
