import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

/**
 * DELETE /api/admin/users/[id]/sanction/[sanctionId]
 *
 * Reverts an active sanction. Sets revertedAt + revertedBy. The sanction row
 * stays in the table for audit; the active query filters it out.
 *
 * Requires the same min-role as issuing the sanction:
 *   chat_banned → moderator
 *   suspended / banned → admin
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sanctionId: string }> },
) {
  const { id: targetUserId, sanctionId } = await params;

  const row = (
    await db
      .select()
      .from(schema.userSanctions)
      .where(
        and(
          eq(schema.userSanctions.id, sanctionId),
          eq(schema.userSanctions.userId, targetUserId),
        ),
      )
      .limit(1)
  )[0];

  if (!row) {
    return NextResponse.json({ error: "Sanction not found" }, { status: 404 });
  }
  if (row.revertedAt) {
    return NextResponse.json(
      { error: "Sanction already reverted" },
      { status: 409 },
    );
  }

  const minRole = row.kind === "chat_banned" ? "moderator" : "admin";
  const guard = await requireMinRole(minRole as "moderator" | "admin");
  if (!guard.ok) return guard.response;

  const nowIso = new Date().toISOString();
  await db
    .update(schema.userSanctions)
    .set({ revertedAt: nowIso, revertedBy: guard.user.id })
    .where(eq(schema.userSanctions.id, sanctionId));

  await writeAudit({
    actorId: guard.user.id,
    action: `user.sanction.revert.${row.kind}`,
    before: { revertedAt: row.revertedAt, revertedBy: row.revertedBy },
    after: { revertedAt: nowIso, revertedBy: guard.user.id },
    targetType: "user",
    targetId: targetUserId,
    meta: {
      role: guard.role,
      sanctionId,
      originalReason: row.reason,
    },
  });

  return NextResponse.json({ ok: true, sanctionId, revertedAt: nowIso });
}
