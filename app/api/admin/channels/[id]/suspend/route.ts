import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { emit } from "@/lib/sse/bus";

const bodySchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/admin/channels/[id]/suspend
 *
 * Suspends a channel. Sets suspendedAt + suspendedReason. Force-ends any
 * currently-live stream on the channel (broadcasts offline). Public list
 * endpoints and the /c/[slug] page filter suspended channels out.
 *
 * Requires admin+.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const channel = (
    await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, id))
      .limit(1)
  )[0];
  if (!channel) return new NextResponse("Channel not found", { status: 404 });
  if (channel.suspendedAt) {
    return NextResponse.json(
      { error: "Channel already suspended" },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();

  // Kick any live streams on this channel.
  const liveStreams = await db
    .update(schema.streams)
    .set({ isLive: false, endedAt: nowIso, viewerCount: 0 })
    .where(
      and(
        eq(schema.streams.channelId, id),
        eq(schema.streams.isLive, true),
      ),
    )
    .returning({ id: schema.streams.id });

  for (const s of liveStreams) {
    emit(`stream:${s.id}:status`, { isLive: false, endedAt: nowIso, forced: true });
  }
  emit(`channel:${id}:offline`, { suspended: true });

  await db
    .update(schema.channels)
    .set({ suspendedAt: nowIso, suspendedReason: parsed.data.reason })
    .where(eq(schema.channels.id, id));

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "broadcast",
    action: "channel.suspend",
    targetType: "channel",
    targetId: id,
    before: {
      suspendedAt: channel.suspendedAt,
      suspendedReason: channel.suspendedReason,
    },
    after: { suspendedAt: nowIso, suspendedReason: parsed.data.reason },
    meta: {
      reason: parsed.data.reason,
      slug: channel.slug,
      publisherId: channel.publisherId,
      kickedStreams: liveStreams.length,
    },
  });

  return NextResponse.json({
    ok: true,
    channelId: id,
    suspendedAt: nowIso,
    kickedStreams: liveStreams.length,
  });
}

/**
 * DELETE /api/admin/channels/[id]/suspend - unsuspend (clears suspendedAt).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const channel = (
    await db.select().from(schema.channels).where(eq(schema.channels.id, id)).limit(1)
  )[0];
  if (!channel) return new NextResponse("Channel not found", { status: 404 });
  if (!channel.suspendedAt) {
    return NextResponse.json(
      { error: "Channel is not suspended" },
      { status: 409 },
    );
  }

  await db
    .update(schema.channels)
    .set({ suspendedAt: null, suspendedReason: null })
    .where(eq(schema.channels.id, id));

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "broadcast",
    action: "channel.unsuspend",
    targetType: "channel",
    targetId: id,
    before: {
      suspendedAt: channel.suspendedAt,
      suspendedReason: channel.suspendedReason,
    },
    after: { suspendedAt: null, suspendedReason: null },
    meta: { slug: channel.slug, publisherId: channel.publisherId },
  });

  return NextResponse.json({ ok: true, channelId: id });
}
