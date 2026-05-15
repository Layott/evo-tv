import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { emit } from "@/lib/sse/bus";

/**
 * DELETE /api/admin/streams/[id]
 *
 * Soft-deletes a stream. Sets deletedAt=now. Public list endpoints filter
 * deletedAt IS NULL so the stream vanishes from feeds. If still live, also
 * force-ends and broadcasts offline. Recoverable within 30 days via a future
 * restore endpoint.
 *
 * Requires `admin` or higher (vs force_end which moderator can do).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const stream = (
    await db.select().from(schema.streams).where(eq(schema.streams.id, id)).limit(1)
  )[0];
  if (!stream) return new NextResponse("Stream not found", { status: 404 });
  if (stream.deletedAt) {
    return NextResponse.json({ error: "Already deleted" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const wasLive = stream.isLive;
  await db
    .update(schema.streams)
    .set({
      deletedAt: nowIso,
      isLive: false,
      endedAt: wasLive ? nowIso : stream.endedAt,
      viewerCount: 0,
    })
    .where(eq(schema.streams.id, id));

  if (wasLive) {
    emit(`stream:${id}:status`, { isLive: false, endedAt: nowIso, deleted: true });
    if (stream.channelId) {
      emit(`channel:${stream.channelId}:offline`, { streamId: id, deleted: true });
    }
  }

  await writeAudit({
    actorId: guard.user.id,
    action: "stream.delete",
    targetType: "stream",
    targetId: id,
    meta: {
      role: guard.role,
      streamerName: stream.streamerName,
      channelId: stream.channelId,
      wasLive,
    },
  });

  return NextResponse.json({ ok: true, streamId: id, deletedAt: nowIso });
}
