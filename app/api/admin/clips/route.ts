import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { generateId, requireAdminFromRequest } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { slugForClip } from "@/lib/api/slugs";

const listQuerySchema = z.object({
  gameId: z.string().optional(),
  channelId: z.string().optional(),
  deleted: z.enum(["only", "include"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/clips - admin list of all clips.
 *
 * Same filter semantics as /api/admin/vods. Moderator+.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { gameId, channelId, deleted, limit, offset } = parsed.data;

  const filters = [
    gameId ? eq(schema.clips.gameId, gameId) : undefined,
    channelId ? eq(schema.clips.channelId, channelId) : undefined,
    deleted === "only"
      ? isNotNull(schema.clips.deletedAt)
      : deleted === "include"
        ? undefined
        : isNull(schema.clips.deletedAt),
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.clips)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.clips.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.clips)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  const clips = rows.map(({ mp4Path, ...rest }) => ({
    ...rest,
    mp4Url: mp4Path,
  }));

  return NextResponse.json({
    clips,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

/** http(s) URL or an absolute /path, the same shape the VOD route accepts. */
const urlOrPath = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "must be an http(s) URL or an absolute /path",
  });

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  gameId: z.string().min(1),
  mp4Url: urlOrPath,
  thumbnailUrl: z.string().trim().min(1).max(2048),
  durationSec: z.number().int().positive().max(60 * 60),
  /** Whose clip it is. Shown on the card, so it is required rather than defaulted. */
  creatorHandle: z.string().trim().min(1).max(100),
  creatorAvatarUrl: z.string().trim().max(2048).default(""),
  pillar: z.enum(["esports", "anime", "lifestyle"]).nullish(),
  maturityRating: z.enum(["kids", "pg", "teen", "mature"]).default("teen"),
  contentTags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  /** What it was cut from. All optional, and at most one source is meaningful. */
  vodId: z.string().min(1).nullable().default(null),
  showId: z.string().min(1).nullable().default(null),
  episodeId: z.string().min(1).nullable().default(null),
});

/**
 * POST /api/admin/clips - upload a clip.
 *
 * The clips table has been readable by the dashboard since the admin API was
 * built, and writable by nothing: clips could only ever appear if something
 * else inserted them. This is the missing half.
 *
 * A clip may be attached to a VOD, to a show, or to a single episode of one.
 * Passing an episode fills in its show, so a clip can never claim to belong to
 * episode three of a series it is not filed under.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  let showId = input.showId;
  if (input.episodeId) {
    const episode = (
      await db
        .select({ id: schema.episodes.id, showId: schema.episodes.showId })
        .from(schema.episodes)
        .where(eq(schema.episodes.id, input.episodeId))
        .limit(1)
    )[0];
    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 422 });
    }
    if (showId && showId !== episode.showId) {
      return NextResponse.json(
        { error: "That episode belongs to a different show" },
        { status: 422 },
      );
    }
    showId = episode.showId;
  }

  if (input.vodId) {
    const vod = (
      await db
        .select({ id: schema.vods.id })
        .from(schema.vods)
        .where(eq(schema.vods.id, input.vodId))
        .limit(1)
    )[0];
    if (!vod) {
      return NextResponse.json({ error: "Video not found" }, { status: 422 });
    }
  }

  const id = generateId("clip");
  const nowIso = new Date().toISOString();

  await db.insert(schema.clips).values({
    id,
    vodId: input.vodId,
    streamId: null,
    showId,
    episodeId: input.episodeId,
    channelId: null,
    title: input.title,
    slug: await slugForClip(input.title),
    creatorHandle: input.creatorHandle,
    creatorAvatarUrl: input.creatorAvatarUrl,
    durationSec: input.durationSec,
    mp4Path: input.mp4Url,
    thumbnailUrl: input.thumbnailUrl,
    viewCount: 0,
    likeCount: 0,
    createdAt: nowIso,
    gameId: input.gameId,
    pillar: input.pillar,
    maturityRating: input.maturityRating,
    contentTags: input.contentTags,
  });

  await writeAudit({
    actorId: guard.user.id,
    action: "clip.create",
    targetType: "clip",
    targetId: id,
    meta: { title: input.title, showId, episodeId: input.episodeId, vodId: input.vodId },
  });

  const row = (
    await db.select().from(schema.clips).where(eq(schema.clips.id, id)).limit(1)
  )[0];
  const { mp4Path, ...rest } = row!;
  return NextResponse.json({ clip: { ...rest, mp4Url: mp4Path } }, { status: 201 });
}
