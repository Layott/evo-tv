import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

/**
 * DELETE /api/admin/vods/[id]
 *
 * Soft-deletes a VOD. Public list endpoints filter deletedAt IS NULL.
 * Requires `admin` or higher.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const vod = (
    await db.select().from(schema.vods).where(eq(schema.vods.id, id)).limit(1)
  )[0];
  if (!vod) return new NextResponse("VOD not found", { status: 404 });
  if (vod.deletedAt) {
    return NextResponse.json({ error: "Already deleted" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  await db
    .update(schema.vods)
    .set({ deletedAt: nowIso })
    .where(eq(schema.vods.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: "vod.delete",
    targetType: "vod",
    targetId: id,
    meta: {
      role: guard.role,
      title: vod.title,
      channelId: vod.channelId,
      streamId: vod.streamId,
    },
  });

  return NextResponse.json({ ok: true, vodId: id, deletedAt: nowIso });
}
