import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { requireCapability } from "@/lib/api/admin";
import { getClipById } from "@/lib/api/vods";

const patchSchema = z
  .object({
    maturityRating: z.enum(["kids", "pg", "teen", "mature"]),
    contentTags: z.array(z.string()),
  })
  .partial();

/**
 * PATCH /api/admin/clips/[id]
 *
 * Admin update of a clip's content classification. Accepts an optional
 * maturityRating and/or contentTags; omitted fields are left unchanged.
 * Returns the updated clip in the public Clip shape.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = (
    await db.select().from(schema.clips).where(eq(schema.clips.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("Clip not found", { status: 404 });

  if (Object.keys(parsed.data).length > 0) {
    await db.update(schema.clips).set(parsed.data).where(eq(schema.clips.id, id));
  }

  return NextResponse.json(await getClipById(id));
}

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
    before: clip as unknown as Record<string, unknown>,
    after: null,
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
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
