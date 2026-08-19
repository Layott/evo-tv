import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { generateId, requireAdminFromRequest } from "@/lib/api/admin";
import { getVodById } from "@/lib/api/vods";
import { slugForVod } from "@/lib/api/slugs";

const listQuerySchema = z.object({
  gameId: z.string().optional(),
  channelId: z.string().optional(),
  deleted: z.enum(["only", "include"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/vods - admin list of all VODs (active + optional deleted).
 *
 *   ?deleted=only     → only soft-deleted rows
 *   ?deleted=include  → both
 *   (omitted)         → active only (default)
 *
 * Moderator+ (same min role as clip moderation; VOD takedown is admin via
 * DELETE /api/admin/vods/[id]).
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
    gameId ? eq(schema.vods.gameId, gameId) : undefined,
    channelId ? eq(schema.vods.channelId, channelId) : undefined,
    deleted === "only"
      ? isNotNull(schema.vods.deletedAt)
      : deleted === "include"
        ? undefined
        : isNull(schema.vods.deletedAt),
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.vods)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.vods.publishedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.vods)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  // Rename hlsPath/mp4Path → hlsUrl/mp4Url to match RN's Vod type.
  const vods = rows.map(({ hlsPath, mp4Path, ...rest }) => ({
    ...rest,
    hlsUrl: hlsPath,
    mp4Url: mp4Path,
  }));

  return NextResponse.json({
    vods,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

/** http(s) URL or an absolute /path (e.g. a Blob URL or an origin-relative file). */
const urlOrPath = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "must be an http(s) URL or an absolute /path",
  });

const createSchema = z.object({
  title: z.string().min(3).max(200),
  gameId: z.string().min(1),
  /** Stored into mp4Path. Typically a Vercel Blob URL from the client-upload flow. */
  mp4Url: urlOrPath,
  /** Stored into hlsPath. Optional; defaults to "" (player falls back to mp4). */
  hlsUrl: urlOrPath.or(z.literal("")).default(""),
  thumbnailUrl: z.string().min(1),
  durationSec: z.number().int().positive(),
  description: z.string().max(2000).default(""),
  pillar: z.enum(["esports", "anime", "lifestyle"]).nullish(),
  maturityRating: z.enum(["kids", "pg", "teen", "mature"]).default("teen"),
  isPremium: z.boolean().default(false),
  contentTags: z.array(z.string()).default([]),
});

/**
 * POST /api/admin/vods - create a VOD row (uploaded media, not a stream
 * recording: streamId/channelId are null, counters start at zero).
 *
 * Admin only. Returns 201 with the created VOD in the public Vod shape
 * (hlsUrl/mp4Url naming, same as getVodById).
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

  const id = generateId("vod");
  const nowIso = new Date().toISOString();

  await db.insert(schema.vods).values({
    id,
    streamId: null,
    channelId: null,
    title: parsed.data.title,
    slug: await slugForVod(parsed.data.title),
    description: parsed.data.description,
    gameId: parsed.data.gameId,
    durationSec: parsed.data.durationSec,
    hlsPath: parsed.data.hlsUrl,
    mp4Path: parsed.data.mp4Url,
    thumbnailUrl: parsed.data.thumbnailUrl,
    publishedAt: nowIso,
    chapters: [],
    viewCount: 0,
    likeCount: 0,
    isPremium: parsed.data.isPremium,
    pillar: parsed.data.pillar,
    maturityRating: parsed.data.maturityRating,
    contentTags: parsed.data.contentTags,
  });

  return NextResponse.json(await getVodById(id), { status: 201 });
}
