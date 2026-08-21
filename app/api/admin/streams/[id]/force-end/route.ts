import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireCapability } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { emit } from "@/lib/sse/bus";

/**
 * POST /api/admin/streams/[id]/force-end
 *
 * Admin "kill switch" for any live stream. Marks the row isLive=false,
 * stamps endedAt, broadcasts offline SSE events (so all viewers' players
 * drop), and writes an audit entry. Does NOT delete the row - it survives
 * for VOD packaging + audit trail.
 *
 * Requires `moderator` or higher.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("broadcast");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const stream = (
    await db.select().from(schema.streams).where(eq(schema.streams.id, id)).limit(1)
  )[0];
  if (!stream) return new NextResponse("Stream not found", { status: 404 });

  if (!stream.isLive) {
    return NextResponse.json(
      { error: "Stream is not live" },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  await db
    .update(schema.streams)
    .set({ isLive: false, endedAt: nowIso, viewerCount: 0 })
    .where(eq(schema.streams.id, id));

  emit(`stream:${id}:status`, { isLive: false, endedAt: nowIso, forced: true });
  if (stream.channelId) {
    emit(`channel:${stream.channelId}:offline`, { streamId: id, forced: true });
  }

  const body = await req.json().catch(() => ({}));
  const reason: string | undefined =
    typeof body?.reason === "string" ? body.reason.slice(0, 500) : undefined;

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "broadcast",
    action: "stream.force_end",
    before: {
      isLive: stream.isLive,
      endedAt: stream.endedAt,
      viewerCount: stream.viewerCount,
    },
    after: { isLive: false, endedAt: nowIso, viewerCount: 0 },
    targetType: "stream",
    targetId: id,
    meta: {
      role: guard.role,
      streamerName: stream.streamerName,
      channelId: stream.channelId,
      reason,
    },
  });

  return NextResponse.json({ ok: true, streamId: id, endedAt: nowIso });
}
