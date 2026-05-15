import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

/**
 * DELETE /api/admin/clips/[id]
 *
 * Soft-deletes a clip. Requires `moderator` or higher (clips are
 * user-generated, moderation is the common case).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const clip = (
    await db.select().from(schema.clips).where(eq(schema.clips.id, id)).limit(1)
  )[0];
  if (!clip) return new NextResponse("Clip not found", { status: 404 });
  if (clip.deletedAt) {
    return NextResponse.json({ error: "Already deleted" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  await db
    .update(schema.clips)
    .set({ deletedAt: nowIso })
    .where(eq(schema.clips.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: "clip.delete",
    targetType: "clip",
    targetId: id,
    meta: {
      role: guard.role,
      title: clip.title,
      channelId: clip.channelId,
      creatorHandle: clip.creatorHandle,
    },
  });

  return NextResponse.json({ ok: true, clipId: id, deletedAt: nowIso });
}
