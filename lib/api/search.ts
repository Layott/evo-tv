import "server-only";
import { like, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Game, Team, Player, EsportsEvent, Stream, Vod } from "@/lib/types";
import { listGames } from "./games";
import { listTeams } from "./teams";
import { listPlayers } from "./players";

export interface SearchResults {
  games: Game[];
  teams: Team[];
  players: Player[];
  events: EsportsEvent[];
  streams: Stream[];
  vods: Vod[];
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q) {
    return { games: [], teams: [], players: [], events: [], streams: [], vods: [] };
  }
  const pat = `%${q.toLowerCase()}%`;

  const games = (await listGames()).filter(
    (g) => g.name.toLowerCase().includes(q.toLowerCase()) || g.slug.includes(q.toLowerCase())
  );
  const teams = (await listTeams()).filter(
    (t) =>
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      t.tag.toLowerCase().includes(q.toLowerCase()) ||
      t.slug.includes(q.toLowerCase())
  );
  const players = (await listPlayers()).filter(
    (p) =>
      p.handle.toLowerCase().includes(q.toLowerCase()) ||
      p.realName.toLowerCase().includes(q.toLowerCase())
  );

  const eventRows = await db
    .select()
    .from(schema.events)
    .where(or(like(schema.events.title, pat), like(schema.events.slug, pat)));
  const teamRelRows = eventRows.length
    ? await db.select().from(schema.eventTeams)
    : [];
  const eventTeams: EsportsEvent[] = eventRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    gameId: r.gameId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status as EsportsEvent["status"],
    tier: r.tier as EsportsEvent["tier"],
    bannerUrl: r.bannerUrl,
    thumbnailUrl: r.thumbnailUrl,
    description: r.description,
    prizePoolNgn: r.prizePoolNgn,
    teamIds: teamRelRows.filter((x) => x.eventId === r.id).map((x) => x.teamId),
    region: r.region,
    format: r.format,
    viewerCount: r.viewerCount,
  }));

  const streamRows = await db
    .select()
    .from(schema.streams)
    .where(like(schema.streams.title, pat));
  const streams: Stream[] = streamRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    eventId: r.eventId,
    gameId: r.gameId,
    streamerType: r.streamerType as Stream["streamerType"],
    streamerName: r.streamerName,
    streamerAvatarUrl: r.streamerAvatarUrl,
    isLive: r.isLive,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    hlsUrl: r.hlsPath,
    thumbnailUrl: r.thumbnailUrl,
    viewerCount: r.viewerCount,
    peakViewerCount: r.peakViewerCount,
    language: r.language,
    tags: r.tags,
    isPremium: r.isPremium,
  }));

  const vodRows = await db
    .select()
    .from(schema.vods)
    .where(like(schema.vods.title, pat));
  const vods: Vod[] = vodRows.map((r) => ({
    id: r.id,
    streamId: r.streamId,
    title: r.title,
    description: r.description,
    gameId: r.gameId,
    durationSec: r.durationSec,
    hlsUrl: r.hlsPath,
    mp4Url: r.mp4Path,
    thumbnailUrl: r.thumbnailUrl,
    publishedAt: r.publishedAt,
    chapters: r.chapters,
    viewCount: r.viewCount,
    likeCount: r.likeCount,
    isPremium: r.isPremium,
  }));

  return { games, teams, players, events: eventTeams, streams, vods };
}

export async function searchSuggestions(query: string, limit = 8): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = await globalSearch(query);
  const pool: string[] = [
    ...results.games.map((g) => g.name),
    ...results.teams.map((t) => t.name),
    ...results.players.map((p) => p.handle),
    ...results.events.map((e) => e.title),
    ...results.streams.map((s) => s.title),
  ];
  return Array.from(new Set(pool)).slice(0, limit);
}
