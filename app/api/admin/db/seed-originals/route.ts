import "server-only";
import { NextResponse } from "next/server";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { hasMinRole } from "@/lib/auth/roles";
import { log } from "@/lib/log";

/**
 * POST /api/admin/db/seed-originals — one-shot seed for Phase 9b shows.
 *
 * Admin-only. Idempotent — uses ON CONFLICT DO NOTHING so re-runs are safe.
 * Mirrors the IDs used in evotv-app/lib/mock/shows.ts so the RN frontend
 * can swap from mock to api without ID churn.
 *
 * Inserts 5 shows, 9 seasons, 32 episodes. Run once after sync-migrations
 * has created the shows/seasons/episodes tables.
 */

interface ShowSeed {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  heroUrl: string;
  posterUrl: string;
  pillar: "esports" | "anime" | "lifestyle";
  originType: "evo_original" | "licensed" | "syndicated";
  status: "airing" | "completed" | "upcoming" | "hiatus";
  primaryCreatorHandle: string;
  totalSeasons: number;
  totalEpisodes: number;
  rating: number;
  releasedDaysAgo: number;
  tags: string[];
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

const SHOWS: ShowSeed[] = [
  {
    id: "show_naija_esports_inside",
    slug: "inside-naija-esports",
    title: "Inside Naija Esports",
    synopsis:
      "Behind-the-scenes with West Africa's top-ranked esports teams. Practice rituals, road trips, locker-room mics, and the tournaments that made the careers.",
    heroUrl: "",
    posterUrl: "",
    pillar: "esports",
    originType: "evo_original",
    status: "airing",
    primaryCreatorHandle: "evotv-originals",
    totalSeasons: 2,
    totalEpisodes: 8,
    rating: 8.6,
    releasedDaysAgo: 120,
    tags: ["Docuseries", "Africa", "Esports"],
  },
  {
    id: "show_otaku_court",
    slug: "otaku-court",
    title: "Otaku Court",
    synopsis:
      "Weekly anime debate show. Three otakus, one verdict. New episodes Friday — every season closes with a community-voted finale.",
    heroUrl: "",
    posterUrl: "",
    pillar: "anime",
    originType: "evo_original",
    status: "airing",
    primaryCreatorHandle: "otaku-talk",
    totalSeasons: 2,
    totalEpisodes: 12,
    rating: 9.1,
    releasedDaysAgo: 90,
    tags: ["Anime", "Debate", "Weekly"],
  },
  {
    id: "show_sukuna_armor_diaries",
    slug: "sukuna-armor-diaries",
    title: "Sukuna Armor Diaries",
    synopsis:
      "Six-episode build-along: foam, EVA, paint, weathering. By the season finale you have your own Sukuna armor for the next con.",
    heroUrl: "",
    posterUrl: "",
    pillar: "anime",
    originType: "licensed",
    status: "completed",
    primaryCreatorHandle: "cosplay-sunday",
    totalSeasons: 1,
    totalEpisodes: 6,
    rating: 8.4,
    releasedDaysAgo: 45,
    tags: ["Anime", "Cosplay", "Build-along"],
  },
  {
    id: "show_lagos_after_dark",
    slug: "lagos-after-dark",
    title: "Lagos After Dark",
    synopsis:
      "What happens when the city sleeps. Nightshift workers, after-hours kitchens, dawn-rave promoters. Eight-part lifestyle audio-doc series.",
    heroUrl: "",
    posterUrl: "",
    pillar: "lifestyle",
    originType: "evo_original",
    status: "airing",
    primaryCreatorHandle: "lagos-lifestyle-pod",
    totalSeasons: 1,
    totalEpisodes: 8,
    rating: 8.9,
    releasedDaysAgo: 30,
    tags: ["Lifestyle", "Podcast", "Lagos", "Audio-doc"],
  },
  {
    id: "show_continent_tech",
    slug: "continent-tech",
    title: "Continent Tech",
    synopsis:
      "Weekly long-form interviews with African founders building global products. From Nairobi AI labs to Cape Town fintech — the conversations behind the cap tables.",
    heroUrl: "",
    posterUrl: "",
    pillar: "lifestyle",
    originType: "evo_original",
    status: "airing",
    primaryCreatorHandle: "tech-talk-africa",
    totalSeasons: 3,
    totalEpisodes: 24,
    rating: 9.3,
    releasedDaysAgo: 200,
    tags: ["Lifestyle", "Tech", "Interview", "Long-form"],
  },
];

interface SeasonSeed {
  id: string;
  showId: string;
  seasonNumber: number;
  title: string;
  episodeCount: number;
  releasedDaysAgo: number;
}

const SEASONS: SeasonSeed[] = [
  { id: "season_naija_s1", showId: "show_naija_esports_inside", seasonNumber: 1, title: "Free Fire reign", episodeCount: 4, releasedDaysAgo: 120 },
  { id: "season_naija_s2", showId: "show_naija_esports_inside", seasonNumber: 2, title: "Cross-game expansion", episodeCount: 4, releasedDaysAgo: 30 },
  { id: "season_otaku_s1", showId: "show_otaku_court", seasonNumber: 1, title: "Founding rulings", episodeCount: 6, releasedDaysAgo: 90 },
  { id: "season_otaku_s2", showId: "show_otaku_court", seasonNumber: 2, title: "The community-trial era", episodeCount: 6, releasedDaysAgo: 20 },
  { id: "season_sukuna_s1", showId: "show_sukuna_armor_diaries", seasonNumber: 1, title: "Foam to finale", episodeCount: 6, releasedDaysAgo: 45 },
  { id: "season_lagos_s1", showId: "show_lagos_after_dark", seasonNumber: 1, title: "After-hours Lagos", episodeCount: 8, releasedDaysAgo: 30 },
  { id: "season_tech_s1", showId: "show_continent_tech", seasonNumber: 1, title: "Year one", episodeCount: 8, releasedDaysAgo: 200 },
  { id: "season_tech_s2", showId: "show_continent_tech", seasonNumber: 2, title: "Year two", episodeCount: 8, releasedDaysAgo: 120 },
  { id: "season_tech_s3", showId: "show_continent_tech", seasonNumber: 3, title: "Year three", episodeCount: 8, releasedDaysAgo: 20 },
];

interface EpisodeSeedRow {
  title: string;
  synopsis: string;
  runtimeSec: number;
  releasedDaysAgo: number;
}

const EPISODE_SEEDS: Record<string, EpisodeSeedRow[]> = {
  season_naija_s1: [
    { title: "Lagos team-house tour", synopsis: "Inside Team Alpha's apartment-block bootcamp.", runtimeSec: 1620, releasedDaysAgo: 115 },
    { title: "Practice-day rituals", synopsis: "Pre-scrim warm-ups, custom-loadout debates.", runtimeSec: 1740, releasedDaysAgo: 100 },
    { title: "Road to Casablanca", synopsis: "First-ever cross-region travel for an African mobile esports squad.", runtimeSec: 1900, releasedDaysAgo: 80 },
    { title: "Finals day — through the headset", synopsis: "Locker-room mic from kick-off to trophy lift.", runtimeSec: 2100, releasedDaysAgo: 60 },
  ],
  season_naija_s2: [
    { title: "Why we picked up CoD Mobile", synopsis: "The strategy meeting that birthed Alpha's second squad.", runtimeSec: 1500, releasedDaysAgo: 25 },
    { title: "Coach swap mid-season", synopsis: "The decision nobody saw coming.", runtimeSec: 1620, releasedDaysAgo: 18 },
    { title: "Nairobi Open recap", synopsis: "Three matches, two upsets, one absolute clutch.", runtimeSec: 1800, releasedDaysAgo: 10 },
    { title: "What's next: PUBG", synopsis: "Three months out from the announcement.", runtimeSec: 1680, releasedDaysAgo: 3 },
  ],
  season_otaku_s1: [
    { title: "Is Frieren actually slow?", synopsis: "The court rules on pacing complaints.", runtimeSec: 2700, releasedDaysAgo: 88 },
    { title: "JJK manga vs anime — the verdict", synopsis: "When does adaptation pacing go wrong?", runtimeSec: 2820, releasedDaysAgo: 75 },
    { title: "Demon Slayer S4 expectations", synopsis: "Pre-premiere predictions show.", runtimeSec: 2600, releasedDaysAgo: 60 },
    { title: "Shounen tropes — necessary or not?", synopsis: "Friendship, training arcs, the works.", runtimeSec: 2880, releasedDaysAgo: 50 },
    { title: "Best fight scene of the year", synopsis: "Community-submitted clips, judged live.", runtimeSec: 3000, releasedDaysAgo: 40 },
    { title: "Season 1 verdicts: revisited", synopsis: "Three months later — what did the court get wrong?", runtimeSec: 2700, releasedDaysAgo: 25 },
  ],
  season_otaku_s2: [
    { title: "Live anime release calendar overhaul", synopsis: "Why subs/dubs shifted in 2026.", runtimeSec: 2700, releasedDaysAgo: 18 },
    { title: "Manga publishers vs streaming", synopsis: "The economics nobody talks about.", runtimeSec: 2880, releasedDaysAgo: 14 },
    { title: "Cosplay etiquette", synopsis: "Boundary debate. Long overdue.", runtimeSec: 2700, releasedDaysAgo: 9 },
    { title: "Best opening of the decade", synopsis: "The brackets, the picks, the salt.", runtimeSec: 3000, releasedDaysAgo: 6 },
    { title: "Niche anime everyone missed", synopsis: "Court rules on under-watched gems.", runtimeSec: 2820, releasedDaysAgo: 3 },
    { title: "Community trial: this season's MVP", synopsis: "Audience votes live.", runtimeSec: 2700, releasedDaysAgo: 1 },
  ],
  season_sukuna_s1: [
    { title: "Episode 1 — Foam pattern fitting", synopsis: "Print + cut + tape-fit walkthrough.", runtimeSec: 2400, releasedDaysAgo: 45 },
    { title: "Episode 2 — Heat-shaping the chestplate", synopsis: "Curves without cracks.", runtimeSec: 2580, releasedDaysAgo: 40 },
    { title: "Episode 3 — EVA detailing", synopsis: "Where the texture comes from.", runtimeSec: 2700, releasedDaysAgo: 35 },
    { title: "Episode 4 — Base-coating", synopsis: "Plasti-dip, primer, anchor coats.", runtimeSec: 2520, releasedDaysAgo: 30 },
    { title: "Episode 5 — Weathering", synopsis: "Battle-damage techniques.", runtimeSec: 2640, releasedDaysAgo: 25 },
    { title: "Episode 6 — Finale: wearing it", synopsis: "Strap-up, photo session, post-mortem.", runtimeSec: 2820, releasedDaysAgo: 20 },
  ],
  season_lagos_s1: [
    { title: "Episode 1 — 11pm: the kitchens", synopsis: "Suya stands, late-night chefs, the smoke.", runtimeSec: 2520, releasedDaysAgo: 28 },
    { title: "Episode 2 — Midnight: drivers", synopsis: "Uber, danfo, road-runners.", runtimeSec: 2580, releasedDaysAgo: 25 },
    { title: "Episode 3 — 1am: club promoters", synopsis: "Who's working, who's spending.", runtimeSec: 2700, releasedDaysAgo: 21 },
    { title: "Episode 4 — 2am: the dancers", synopsis: "Routines, choreography, the after-after.", runtimeSec: 2640, releasedDaysAgo: 18 },
    { title: "Episode 5 — 3am: studios", synopsis: "Where Lagos pop is recorded.", runtimeSec: 2880, releasedDaysAgo: 14 },
    { title: "Episode 6 — 4am: the markets", synopsis: "Fish, produce, the loading docks.", runtimeSec: 2520, releasedDaysAgo: 10 },
    { title: "Episode 7 — 5am: the dawn ravers", synopsis: "Beach parties at sunrise.", runtimeSec: 2700, releasedDaysAgo: 6 },
    { title: "Episode 8 — 6am: shift change", synopsis: "Where night ends and day begins.", runtimeSec: 2820, releasedDaysAgo: 2 },
  ],
  season_tech_s3: [
    { title: "Nairobi AI labs — the founder interviews", synopsis: "Three startups, one corridor.", runtimeSec: 3300, releasedDaysAgo: 19 },
    { title: "Lagos fintech round-up", synopsis: "Who's lending, who's collecting.", runtimeSec: 3000, releasedDaysAgo: 16 },
    { title: "Cape Town SaaS scene", synopsis: "Bootstrapping vs venture in 2026.", runtimeSec: 3180, releasedDaysAgo: 12 },
    { title: "Accra dev tools week", synopsis: "Conferences, code, contracts.", runtimeSec: 3060, releasedDaysAgo: 9 },
    { title: "Egypt crypto reset", synopsis: "Post-regulation interviews.", runtimeSec: 3240, releasedDaysAgo: 6 },
    { title: "Continent-wide developer survey", synopsis: "Year-three findings.", runtimeSec: 3360, releasedDaysAgo: 3 },
    { title: "Founders who left and came back", synopsis: "Return-migration stories.", runtimeSec: 3120, releasedDaysAgo: 2 },
    { title: "What's next: Year four", synopsis: "Predictions show.", runtimeSec: 2700, releasedDaysAgo: 0 },
  ],
};

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  if (!hasMinRole(user.role, "admin")) {
    return new NextResponse("Admin only", { status: 403 });
  }

  const counts = { shows: 0, seasons: 0, episodes: 0 };

  try {
    for (const s of SHOWS) {
      await db
        .insert(schema.shows)
        .values({
          id: s.id,
          slug: s.slug,
          title: s.title,
          synopsis: s.synopsis,
          heroUrl: s.heroUrl,
          posterUrl: s.posterUrl,
          pillar: s.pillar,
          originType: s.originType,
          status: s.status,
          primaryCreatorHandle: s.primaryCreatorHandle,
          totalSeasons: s.totalSeasons,
          totalEpisodes: s.totalEpisodes,
          rating: s.rating,
          releasedAt: daysAgo(s.releasedDaysAgo),
          tags: s.tags,
        })
        .onConflictDoNothing();
      counts.shows++;
    }

    for (const ss of SEASONS) {
      await db
        .insert(schema.seasons)
        .values({
          id: ss.id,
          showId: ss.showId,
          seasonNumber: ss.seasonNumber,
          title: ss.title,
          episodeCount: ss.episodeCount,
          releasedAt: daysAgo(ss.releasedDaysAgo),
        })
        .onConflictDoNothing();
      counts.seasons++;
    }

    for (const [seasonId, eps] of Object.entries(EPISODE_SEEDS)) {
      const season = SEASONS.find((s) => s.id === seasonId);
      if (!season) continue;
      for (let i = 0; i < eps.length; i++) {
        const e = eps[i]!;
        const episodeId = `${seasonId}_e${i + 1}`;
        await db
          .insert(schema.episodes)
          .values({
            id: episodeId,
            showId: season.showId,
            seasonId: season.id,
            seasonNumber: season.seasonNumber,
            episodeNumber: i + 1,
            title: e.title,
            synopsis: e.synopsis,
            thumbnailUrl: "",
            runtimeSec: e.runtimeSec,
            hlsUrl: "/demo/sample.m3u8",
            introStartSec: 6,
            introEndSec: 18,
            premiereAt: daysAgo(e.releasedDaysAgo),
            releasedAt: daysAgo(e.releasedDaysAgo),
          })
          .onConflictDoNothing();
        counts.episodes++;
      }
    }

    log.info("admin.db.seed-originals.ok", { actorId: user.id, counts });
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("admin.db.seed-originals.failed", {
      actorId: user.id,
      error: msg,
      counts,
    });
    return NextResponse.json(
      { ok: false, error: msg, partialCounts: counts },
      { status: 500 },
    );
  }
}
