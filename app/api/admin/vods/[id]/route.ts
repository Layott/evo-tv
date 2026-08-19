import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { requireCapability } from "@/lib/api/admin";
import { getVodById } from "@/lib/api/vods";

/** http(s) URL or an absolute /path. "" clears the field. */
const urlOrPath = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "must be an http(s) URL or an absolute /path",
  });

/**
 * A chapter marker, so a long recording can be navigated.
 *
 * `startSec` rather than a timestamp string: the player seeks in seconds, and a
 * string would have to be parsed by every consumer that wants to compare two.
 */
const chapter = z.object({
  // `label`, matching the column. The player and the VOD page both read that
  // name; calling it `title` here would only be a rename to undo on the way in.
  label: z.string().trim().min(1).max(200),
  startSec: z.number().int().min(0).max(24 * 60 * 60),
});

const patchSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().max(2000),
    gameId: z.string().min(1),
    pillar: z.enum(["esports", "anime", "lifestyle"]).nullable(),
    isPremium: z.boolean(),
    durationSec: z.number().int().positive().max(24 * 60 * 60),
    hlsUrl: urlOrPath,
    mp4Url: urlOrPath,
    thumbnailUrl: urlOrPath,
    chapters: z.array(chapter).max(100),
    maturityRating: z.enum(["kids", "pg", "teen", "mature"]),
    contentTags: z.array(z.string().trim().min(1).max(40)).max(30),
    /**
     * When it should appear. Null publishes it now, which is what the
     * "Publish now" button sends.
     */
    publishAt: z.string().datetime().nullable(),
  })
  .partial();

/**
 * PATCH /api/admin/vods/[id]
 *
 * Everything about a VOD, not just its classification. This used to accept
 * three fields - maturity, tags and thumbnail - which meant a video uploaded
 * with a typo in its title kept the typo forever, and a file uploaded to the
 * wrong row could never be replaced. Omitted fields are left unchanged.
 *
 * `hlsUrl` and `mp4Url` map onto `hlsPath` and `mp4Path` in the table. The
 * column names are older than the public shape and the mapper already hides
 * them, so accepting the public names here keeps one vocabulary for callers.
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
    await db.select().from(schema.vods).where(eq(schema.vods.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("VOD not found", { status: 404 });

  const { hlsUrl, mp4Url, ...columns } = parsed.data;
  const patch = {
    ...columns,
    ...(hlsUrl === undefined ? {} : { hlsPath: hlsUrl }),
    ...(mp4Url === undefined ? {} : { mp4Path: mp4Url }),
  };

  if (Object.keys(patch).length > 0) {
    await db.update(schema.vods).set(patch).where(eq(schema.vods.id, id));

    await writeAudit({
      actorId: guard.user.id,
      actorRole: guard.role,
      capability: "editorial",
      action: "vod.update",
      targetType: "vod",
      targetId: id,
      meta: { fields: Object.keys(patch), title: existing.title },
    });
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
    actorRole: guard.role,
    capability: "editorial",
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
