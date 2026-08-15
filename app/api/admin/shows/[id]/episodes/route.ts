import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { generateId, requireAdminFromRequest } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import {
  nextEpisodeNumber,
  recountShow,
  urlOrPath,
} from "@/lib/api/shows-admin";
import { refreshShowStatus } from "@/lib/api/show-state";

/**
 * The episode leg of the Shows CMS.
 *
 * An episode is the only row in the tree that carries a video, so this is the
 * endpoint the upload flow finishes at: the browser PUTs the file straight to
 * Spaces via `/api/admin/uploads/client`, then posts the URL it already knows
 * here. Nothing streams video through this process.
 */

/** GET /api/admin/shows/[id]/episodes - every live episode on a show, in running order. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const episodes = await db
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.showId, id), isNull(schema.episodes.deletedAt)))
    .orderBy(asc(schema.episodes.seasonNumber), asc(schema.episodes.episodeNumber));

  return NextResponse.json({ episodes });
}

const createSchema = z.object({
  seasonId: z.string().trim().min(1),
  /** Omit to take the next free number in that season. */
  episodeNumber: z.number().int().min(1).max(2000).optional(),
  title: z.string().trim().min(1).max(200),
  synopsis: z.string().max(4000).default(""),
  thumbnailUrl: urlOrPath.default(""),
  hlsUrl: urlOrPath.default(""),
  runtimeSec: z.number().int().min(0).max(24 * 60 * 60).default(0),
  /**
   * Omitted means "whatever the show is", not "free". An editor who marked the
   * series paid should not have to remember to tick each episode, and an
   * episode that silently defaulted to free would be a paywall hole rather than
   * a cosmetic bug.
   */
  isPremium: z.boolean().optional(),
  maturityRating: z.enum(["kids", "pg", "teen", "mature"]).optional(),
  contentTags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  introStartSec: z.number().int().min(0).nullable().default(null),
  introEndSec: z.number().int().min(0).nullable().default(null),
  premiereAt: z.string().datetime().nullable().default(null),
  releasedAt: z.string().datetime().nullable().default(null),
});

/**
 * POST /api/admin/shows/[id]/episodes - add an episode to a season.
 *
 * `seasonNumber` is copied from the season row rather than accepted from the
 * client. The (showId, seasonNumber, episodeNumber) index is what every episode
 * lookup goes through, so a client that sent a number disagreeing with its own
 * seasonId would create a row nothing could find.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const show = (
    await db
      .select({
        id: schema.shows.id,
        title: schema.shows.title,
        isPremium: schema.shows.isPremium,
        maturityRating: schema.shows.maturityRating,
      })
      .from(schema.shows)
      .where(eq(schema.shows.id, id))
      .limit(1)
  )[0];
  if (!show) return new NextResponse("Show not found", { status: 404 });

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

  // The season has to belong to this show. The foreign key only proves the
  // season exists, so without this an episode could be filed under one show
  // while pointing at another show's season.
  const season = (
    await db
      .select({
        id: schema.seasons.id,
        showId: schema.seasons.showId,
        seasonNumber: schema.seasons.seasonNumber,
      })
      .from(schema.seasons)
      .where(eq(schema.seasons.id, input.seasonId))
      .limit(1)
  )[0];
  if (!season || season.showId !== id) {
    return NextResponse.json(
      { error: "That season does not belong to this show" },
      { status: 422 },
    );
  }

  const episodeNumber =
    input.episodeNumber ?? (await nextEpisodeNumber(season.id));

  // Counts soft-deleted rows deliberately: restoring a pulled episode must not
  // collide with one that took its number in the meantime.
  const clash = (
    await db
      .select({ id: schema.episodes.id })
      .from(schema.episodes)
      .where(
        and(
          eq(schema.episodes.seasonId, season.id),
          eq(schema.episodes.episodeNumber, episodeNumber),
        ),
      )
      .limit(1)
  )[0];
  if (clash) {
    return NextResponse.json(
      {
        error: `Season ${season.seasonNumber} already has an episode ${episodeNumber}`,
      },
      { status: 409 },
    );
  }

  const episodeId = generateId("episode");
  await db.insert(schema.episodes).values({
    id: episodeId,
    showId: id,
    seasonId: season.id,
    seasonNumber: season.seasonNumber,
    episodeNumber,
    title: input.title,
    synopsis: input.synopsis,
    thumbnailUrl: input.thumbnailUrl,
    runtimeSec: input.runtimeSec,
    hlsUrl: input.hlsUrl,
    introStartSec: input.introStartSec,
    introEndSec: input.introEndSec,
    premiereAt: input.premiereAt,
    releasedAt: input.releasedAt,
    isPremium: input.isPremium ?? show.isPremium,
    maturityRating: input.maturityRating ?? show.maturityRating,
    contentTags: input.contentTags,
  });

  await recountShow(id);
  // A released episode is what moves a show from upcoming to airing.
  await refreshShowStatus(id);

  await writeAudit({
    actorId: guard.user.id,
    action: "episode.create",
    targetType: "episode",
    targetId: episodeId,
    meta: {
      showId: id,
      showTitle: show.title,
      seasonNumber: season.seasonNumber,
      episodeNumber,
      title: input.title,
    },
  });

  const episode = (
    await db
      .select()
      .from(schema.episodes)
      .where(eq(schema.episodes.id, episodeId))
      .limit(1)
  )[0];
  return NextResponse.json({ episode }, { status: 201 });
}
