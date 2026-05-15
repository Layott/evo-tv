import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

const listQuerySchema = z.object({
  gameId: z.string().optional(),
  channelId: z.string().optional(),
  deleted: z.enum(["only", "include"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/vods — admin list of all VODs (active + optional deleted).
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
