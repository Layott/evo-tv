import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requirePublisherRoleByChannel } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { generateStreamKey, hashStreamKey } from "@/lib/video/stream-key";

/**
 * GET — Reveal whether the channel has an active stream key (boolean only;
 *       plaintext key is NEVER returned after creation).
 * POST — Rotate. Generate a fresh key, mark all existing rows for this
 *        channel inactive, insert the new row, and return the plaintext
 *        key in the response body. THIS IS THE ONLY TIME plaintext is
 *        sent across the wire — clients must show "copy now or never".
 *
 * Auth: requires publisher_members.role >= editor on the publisher that
 * owns this channel, OR EVO admin.
 */

function generateKeyRowId(): string {
  return (
    "csk_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requirePublisherRoleByChannel(id, "viewer");
  if (!guard.ok) return guard.response;

  const active = (
    await db
      .select({
        id: schema.channelStreamKeys.id,
        createdAt: schema.channelStreamKeys.createdAt,
        rotatedAt: schema.channelStreamKeys.rotatedAt,
      })
      .from(schema.channelStreamKeys)
      .where(
        and(
          eq(schema.channelStreamKeys.channelId, id),
          eq(schema.channelStreamKeys.active, true),
        ),
      )
      .limit(1)
  )[0];

  return NextResponse.json({
    hasActiveKey: !!active,
    activeKey: active
      ? {
          id: active.id,
          createdAt: active.createdAt,
          rotatedAt: active.rotatedAt,
        }
      : null,
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requirePublisherRoleByChannel(id, "editor");
  if (!guard.ok) return guard.response;

  const nowIso = new Date().toISOString();

  // Mark all existing keys for this channel inactive (rotation history kept).
  await db
    .update(schema.channelStreamKeys)
    .set({ active: false, rotatedAt: nowIso })
    .where(
      and(
        eq(schema.channelStreamKeys.channelId, id),
        eq(schema.channelStreamKeys.active, true),
      ),
    );

  const plaintextKey = generateStreamKey();
  const keyHash = hashStreamKey(plaintextKey);
  const rowId = generateKeyRowId();

  await db.insert(schema.channelStreamKeys).values({
    id: rowId,
    channelId: id,
    keyHash,
    active: true,
    createdAt: nowIso,
  });

  void writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "stream",
    targetId: id,
    meta: { event: "rotate_stream_key", keyRowId: rowId },
  });

  return NextResponse.json({
    streamKey: plaintextKey,
    id: rowId,
    createdAt: nowIso,
    notice:
      "Save this stream key now. It will NEVER be shown again. " +
      "If lost, rotate to issue a new one.",
  });
}
