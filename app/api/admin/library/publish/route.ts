import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { auditFromGuard, generateId, requireCapability } from "@/lib/api/admin";
import { slugForShow, slugForVod } from "@/lib/api/slugs";
import { refreshShowStatus } from "@/lib/api/show-state";

/**
 * One upload, filed where it belongs.
 *
 * Uploading a video meant creating a VOD, and putting that video in a series
 * meant going to Shows, making the show, making a season, then coming back and
 * making the episode by hand with the same URL pasted a second time. Two
 * screens, four forms, and a video that existed twice if anybody stopped
 * halfway.
 *
 * This is the single call the upload form makes. It takes the file the browser
 * has already PUT to Spaces and either:
 *
 *   - hangs it on an existing show as an episode, inheriting what the show
 *     already knows, or
 *   - creates the show, its first season and the episode in one go, so a series
 *     can begin with its first upload rather than needing to exist first, or
 *   - files it as a standalone VOD, which is what the form did before.
 *
 * Everything happens in one transaction. A half-made show with no episodes is
 * worse than a failed upload: it appears in the catalogue, it is empty, and
 * nobody knows whether it is a mistake or a plan.
 */

const urlOrPath = z.string().trim().max(2048);

const newShowSchema = z.object({
  title: z.string().trim().min(2).max(200),
  synopsis: z.string().max(4000).default(""),
  pillar: z.enum(["esports", "anime", "lifestyle"]).nullish(),
  originType: z
    .enum(["evo_original", "licensed", "syndicated"])
    .default("evo_original"),
  posterUrl: urlOrPath.default(""),
  heroUrl: urlOrPath.default(""),
  isPremium: z.boolean().default(false),
  maturityRating: z.enum(["kids", "pg", "teen", "mature"]).default("teen"),
});

const bodySchema = z.object({
  /** The file, already uploaded. This route never handles bytes. */
  hlsUrl: urlOrPath.min(1),
  title: z.string().trim().min(1).max(200),
  synopsis: z.string().max(4000).default(""),
  thumbnailUrl: urlOrPath.default(""),
  runtimeSec: z.number().int().min(0).max(24 * 60 * 60).default(0),
  /** Absent means the show's answer, not "free". */
  isPremium: z.boolean().optional(),
  maturityRating: z.enum(["kids", "pg", "teen", "mature"]).optional(),
  pillar: z.enum(["esports", "anime", "lifestyle"]).nullish(),
  /** When it should appear. Null means now. */
  publishAt: z.string().datetime().nullable().default(null),

  /** Exactly one of these decides where the video lands. */
  showId: z.string().trim().min(1).optional(),
  newShow: newShowSchema.optional(),
  seasonNumber: z.number().int().min(1).max(200).optional(),
  /** Omit to take the next free number in that season. */
  episodeNumber: z.number().int().min(1).max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  if (input.showId && input.newShow) {
    return NextResponse.json(
      { error: "Pick an existing show or describe a new one, not both" },
      { status: 400 },
    );
  }

  /* ── Standalone: a VOD, the way the form has always worked ─────────────── */
  if (!input.showId && !input.newShow) {
    const vodId = generateId("vod");
    await db.insert(schema.vods).values({
      id: vodId,
      streamId: null,
      channelId: null,
      title: input.title,
      slug: await slugForVod(input.title),
      description: input.synopsis,
      gameId: null,
      pillar: input.pillar ?? null,
      durationSec: input.runtimeSec,
      // The column is a path, not a URL: the reader composes the origin.
      hlsPath: input.hlsUrl,
      mp4Path: "",
      thumbnailUrl: input.thumbnailUrl,
      publishedAt: new Date().toISOString(),
      chapters: [],
      isPremium: input.isPremium ?? false,
      maturityRating: input.maturityRating ?? "teen",
    });

    await auditFromGuard(guard, "editorial", {
      action: "vod.create",
      targetType: "vod",
      targetId: vodId,
      after: { title: input.title, hlsUrl: input.hlsUrl },
      meta: { standalone: true },
    });

    return NextResponse.json({ kind: "vod", vodId }, { status: 201 });
  }

  /* ── In a series ───────────────────────────────────────────────────────── */
  const result = await db.transaction(async (tx) => {
    let showId = input.showId ?? null;
    let createdShow = false;

    if (input.newShow) {
      const draft = input.newShow;
      showId = generateId("show");
      await tx.insert(schema.shows).values({
        id: showId,
        slug: await slugForShow(draft.title),
        title: draft.title,
        synopsis: draft.synopsis,
        heroUrl: draft.heroUrl,
        posterUrl: draft.posterUrl,
        pillar: draft.pillar ?? null,
        originType: draft.originType,
        status: "airing",
        isPremium: draft.isPremium,
        maturityRating: draft.maturityRating,
      });
      createdShow = true;
    }

    const show = (
      await tx
        .select({
          id: schema.shows.id,
          title: schema.shows.title,
          isPremium: schema.shows.isPremium,
          maturityRating: schema.shows.maturityRating,
        })
        .from(schema.shows)
        .where(eq(schema.shows.id, showId!))
        .limit(1)
    )[0];
    if (!show) throw new Error("SHOW_NOT_FOUND");

    /*
     * The season, found or made.
     *
     * A show without one cannot hold an episode, and asking an editor to
     * create "Season 1" before their first upload is asking them to do the
     * database's filing.
     */
    const wantedSeason = input.seasonNumber ?? 1;
    let season = (
      await tx
        .select({ id: schema.seasons.id, seasonNumber: schema.seasons.seasonNumber })
        .from(schema.seasons)
        .where(
          and(
            eq(schema.seasons.showId, show.id),
            eq(schema.seasons.seasonNumber, wantedSeason),
          ),
        )
        .limit(1)
    )[0];

    if (!season) {
      const seasonId = generateId("season");
      await tx.insert(schema.seasons).values({
        id: seasonId,
        showId: show.id,
        seasonNumber: wantedSeason,
        title: "",
      });
      season = { id: seasonId, seasonNumber: wantedSeason };
    }

    // The next free number, so two uploads in a row do not collide.
    let episodeNumber = input.episodeNumber;
    if (!episodeNumber) {
      const last = (
        await tx
          .select({ n: schema.episodes.episodeNumber })
          .from(schema.episodes)
          .where(
            and(
              eq(schema.episodes.showId, show.id),
              eq(schema.episodes.seasonNumber, season.seasonNumber),
              isNull(schema.episodes.deletedAt),
            ),
          )
          .orderBy(desc(schema.episodes.episodeNumber))
          .limit(1)
      )[0];
      episodeNumber = (last?.n ?? 0) + 1;
    }

    const clash = (
      await tx
        .select({ id: schema.episodes.id })
        .from(schema.episodes)
        .where(
          and(
            eq(schema.episodes.showId, show.id),
            eq(schema.episodes.seasonNumber, season.seasonNumber),
            eq(schema.episodes.episodeNumber, episodeNumber),
            isNull(schema.episodes.deletedAt),
          ),
        )
        .limit(1)
    )[0];
    if (clash) throw new Error("EPISODE_TAKEN");

    const episodeId = generateId("ep");
    await tx.insert(schema.episodes).values({
      id: episodeId,
      showId: show.id,
      seasonId: season.id,
      seasonNumber: season.seasonNumber,
      episodeNumber,
      title: input.title,
      synopsis: input.synopsis,
      thumbnailUrl: input.thumbnailUrl,
      runtimeSec: input.runtimeSec,
      hlsUrl: input.hlsUrl,
      // Absent means "whatever the show is". An episode that silently defaulted
      // to free would be a hole in the paywall rather than a cosmetic slip.
      isPremium: input.isPremium ?? show.isPremium,
      maturityRating: input.maturityRating ?? show.maturityRating,
      premiereAt: input.publishAt,
    });

    return { showId: show.id, showTitle: show.title, episodeId, episodeNumber, seasonNumber: season.seasonNumber, createdShow };
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "";
    if (message === "SHOW_NOT_FOUND") return { error: "Show not found" as const };
    if (message === "EPISODE_TAKEN") {
      return { error: "That episode number is already taken in this season" as const };
    }
    throw err;
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "Show not found" ? 404 : 409 },
    );
  }

  // Counters and the derived status only make sense once the episode exists.
  await refreshShowStatus(result.showId);

  await auditFromGuard(guard, "editorial", {
    action: result.createdShow ? "show.create_with_episode" : "episode.create",
    before: null,
    targetType: "episode",
    targetId: result.episodeId,
    after: {
      showId: result.showId,
      seasonNumber: result.seasonNumber,
      episodeNumber: result.episodeNumber,
      title: input.title,
      hlsUrl: input.hlsUrl,
    },
    meta: { createdShow: result.createdShow, showTitle: result.showTitle },
  });

  return NextResponse.json(
    {
      kind: "episode",
      showId: result.showId,
      episodeId: result.episodeId,
      seasonNumber: result.seasonNumber,
      episodeNumber: result.episodeNumber,
      createdShow: result.createdShow,
    },
    { status: 201 },
  );
}
