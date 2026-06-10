import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { getVodById } from "@/lib/api/vods";

const patchSchema = z
  .object({
    maturityRating: z.enum(["kids", "pg", "teen", "mature"]),
    contentTags: z.array(z.string()),
  })
  .partial();

/**
 * PATCH /api/admin/vods/[id]
 *
 * Admin update of a VOD's content classification. Accepts an optional
 * maturityRating and/or contentTags; omitted fields are left unchanged.
 * Returns the updated VOD in the public Vod shape.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminFromRequest();
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
    await db.select().from(schema.vods).where(eq(schema.vods.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("VOD not found", { status: 404 });

  if (Object.keys(parsed.data).length > 0) {
    await db.update(schema.vods).set(parsed.data).where(eq(schema.vods.id, id));
  }

  return NextResponse.json(await getVodById(id));
}

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
