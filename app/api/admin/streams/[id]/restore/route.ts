import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

/**
 * POST /api/admin/streams/[id]/restore
 *
 * Reverts a soft-deleted stream (sets deletedAt back to null). Does NOT
 * restart the broadcast - admin can manually go live again, or leave it
 * as a historical row visible in the admin UI.
 *
 * Requires admin+.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const row = (
    await db.select().from(schema.streams).where(eq(schema.streams.id, id)).limit(1)
  )[0];
  if (!row) return new NextResponse("Stream not found", { status: 404 });
  if (!row.deletedAt) {
    return NextResponse.json({ error: "Stream is not deleted" }, { status: 409 });
  }

  await db.update(schema.streams).set({ deletedAt: null }).where(eq(schema.streams.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: "stream.restore",
    targetType: "stream",
    targetId: id,
    meta: { role: guard.role, streamerName: row.streamerName, channelId: row.channelId },
  });

  return NextResponse.json({ ok: true, streamId: id });
}
