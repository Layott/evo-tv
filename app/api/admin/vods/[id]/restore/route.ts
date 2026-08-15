import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

/**
 * POST /api/admin/vods/[id]/restore - admin+. Un-soft-delete a VOD.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const row = (
    await db.select().from(schema.vods).where(eq(schema.vods.id, id)).limit(1)
  )[0];
  if (!row) return new NextResponse("VOD not found", { status: 404 });
  if (!row.deletedAt) {
    return NextResponse.json({ error: "VOD is not deleted" }, { status: 409 });
  }

  await db.update(schema.vods).set({ deletedAt: null }).where(eq(schema.vods.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: "vod.restore",
    targetType: "vod",
    targetId: id,
    meta: { role: guard.role, title: row.title, channelId: row.channelId },
  });

  return NextResponse.json({ ok: true, vodId: id });
}
