import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

/**
 * POST /api/admin/clips/[id]/restore - moderator+. Un-soft-delete a clip.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const row = (
    await db.select().from(schema.clips).where(eq(schema.clips.id, id)).limit(1)
  )[0];
  if (!row) return new NextResponse("Clip not found", { status: 404 });
  if (!row.deletedAt) {
    return NextResponse.json({ error: "Clip is not deleted" }, { status: 409 });
  }

  await db.update(schema.clips).set({ deletedAt: null }).where(eq(schema.clips.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: "clip.restore",
    before: { deletedAt: row.deletedAt },
    after: { deletedAt: null },
    targetType: "clip",
    targetId: id,
    meta: { role: guard.role, title: row.title, channelId: row.channelId },
  });

  return NextResponse.json({ ok: true, clipId: id });
}
