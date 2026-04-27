import { games } from "./games";
import { teams } from "./teams";
import { players } from "./players";
import { events } from "./events";
import { streams } from "./streams";
import { vods } from "./vods";
import { sleep } from "./_util";
import type { Game, Team, Player, EsportsEvent, Stream, Vod } from "@/lib/types";

export interface SearchResults {
  games: Game[];
  teams: Team[];
  players: Player[];
  events: EsportsEvent[];
  streams: Stream[];
  vods: Vod[];
}

export async function globalSearch(query: string): Promise<SearchResults> {
  await sleep(180);
  const q = query.trim().toLowerCase();
  if (!q) {
    return { games: [], teams: [], players: [], events: [], streams: [], vods: [] };
  }
  const match = (s: string) => s.toLowerCase().includes(q);
  return {
    games: games.filter((g) => match(g.name) || match(g.slug)),
    teams: teams.filter((t) => match(t.name) || match(t.tag) || match(t.slug)),
    players: players.filter((p) => match(p.handle) || match(p.realName)),
    events: events.filter((e) => match(e.title) || match(e.slug)),
    streams: streams.filter((s) => match(s.title) || s.tags.some(match)),
    vods: vods.filter((v) => match(v.title)),
  };
}

export async function searchSuggestions(query: string, limit = 8): Promise<string[]> {
  await sleep(60);
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool: string[] = [
    ...games.map((g) => g.name),
    ...teams.map((t) => t.name),
    ...players.map((p) => p.handle),
    ...events.map((e) => e.title),
    ...streams.map((s) => s.title),
  ];
  return Array.from(new Set(pool.filter((s) => s.toLowerCase().includes(q)))).slice(0, limit);
}
