import type {
  Clip,
  EsportsEvent,
  Game,
  Match,
  Player,
  Product,
  Stream,
  Team,
  Vod,
} from "@/lib/types";
import { apiGet, apiList, apiSend } from "./_fetch";

/**
 * Catalogue reads: games, streams, VODs, clips, events, teams, players,
 * products.
 *
 * Signatures mirror the old `lib/mock/*` exactly so a page swaps over by
 * changing its import line and nothing else.
 */

/* ── Games ──────────────────────────────────────────────────────────────── */

export async function listGames(): Promise<Game[]> {
  return apiList<Game>("/api/games");
}

export async function getGameById(id: string): Promise<Game | null> {
  const games = await listGames();
  return games.find((g) => g.id === id) ?? null;
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const games = await listGames();
  return games.find((g) => g.slug === slug) ?? null;
}

/* ── Streams ────────────────────────────────────────────────────────────── */

export async function listLiveStreams(filter?: {
  gameId?: string;
  isPremium?: boolean;
}): Promise<Stream[]> {
  return apiList<Stream>("/api/streams", {
    gameId: filter?.gameId,
    isPremium: filter?.isPremium,
  });
}

export async function listFeaturedStreams(): Promise<Stream[]> {
  return apiList<Stream>("/api/streams", { featured: 1 });
}

export async function getStreamById(id: string): Promise<Stream | null> {
  return apiGet<Stream>(`/api/streams/${encodeURIComponent(id)}`);
}

/** The 24/7 flagship channel. `channel_main` is its stable id. */
export async function getMainChannel(): Promise<Stream | null> {
  return getStreamById("channel_main");
}

/**
 * `/api/reports` takes a `category` from a fixed enum plus free-text `details`,
 * where the mock took a single free-text `reason`. The reason is carried through
 * as the details so nothing the user typed is dropped.
 */
export async function reportStream(
  streamId: string,
  reason = "user-reported",
  /*
   * The route answers `{ ok, reportId }`. This asked for `ticketId`, which no
   * response has ever contained, so the caller destructured undefined and the
   * confirmation read "Ticket: undefined". The report itself was always filed;
   * only the receipt was broken, which is the kind of bug that makes a working
   * feature look dead.
   */
): Promise<{ ok: boolean; reportId: string }> {
  return apiSend<{ ok: boolean; reportId: string }>("POST", "/api/reports", {
    targetType: "stream",
    targetId: streamId,
    category: "other",
    details: reason,
  });
}

/* ── VODs and clips ─────────────────────────────────────────────────────── */

export async function listVods(filter?: {
  gameId?: string;
  isPremium?: boolean;
  limit?: number;
}): Promise<Vod[]> {
  return apiList<Vod>("/api/vods", {
    gameId: filter?.gameId,
    isPremium: filter?.isPremium,
    limit: filter?.limit,
  });
}

export async function getVodById(id: string): Promise<Vod | null> {
  return apiGet<Vod>(`/api/vods/${encodeURIComponent(id)}`);
}

export async function listRelatedVods(
  vodId: string,
  limit = 6,
): Promise<Vod[]> {
  return apiList<Vod>(`/api/vods/${encodeURIComponent(vodId)}/related`, {
    limit,
  });
}

export async function listTrendingClips(limit = 10): Promise<Clip[]> {
  return apiList<Clip>("/api/vods", { clips: "trending", limit });
}

export async function getClipById(id: string): Promise<Clip | null> {
  return apiGet<Clip>(`/api/vods/clips/${encodeURIComponent(id)}`);
}

/* ── Events and matches ─────────────────────────────────────────────────── */

export async function listEvents(filter?: {
  status?: EsportsEvent["status"];
  gameId?: string;
}): Promise<EsportsEvent[]> {
  return apiList<EsportsEvent>("/api/events", {
    status: filter?.status,
    gameId: filter?.gameId,
  });
}

/** The route resolves an id or a slug, and wraps the event with its matches. */
async function fetchEvent(idOrSlug: string) {
  return apiGet<{ event: EsportsEvent; matches: Match[] }>(
    `/api/events/${encodeURIComponent(idOrSlug)}`,
  );
}

export async function getEventById(id: string): Promise<EsportsEvent | null> {
  return (await fetchEvent(id))?.event ?? null;
}

export async function getEventBySlug(
  slug: string,
): Promise<EsportsEvent | null> {
  return (await fetchEvent(slug))?.event ?? null;
}

export async function listMatchesForEvent(eventId: string): Promise<Match[]> {
  return apiList<Match>(`/api/events/${encodeURIComponent(eventId)}/matches`);
}

/** Event plus matches in one request, for pages that need both. */
export async function getEventWithMatches(
  idOrSlug: string,
): Promise<{ event: EsportsEvent; matches: Match[] } | null> {
  return fetchEvent(idOrSlug);
}

/* ── Teams and players ──────────────────────────────────────────────────── */

export async function listTeams(filter?: { gameId?: string }): Promise<Team[]> {
  return apiList<Team>("/api/teams", { gameId: filter?.gameId });
}

export async function getTeamById(id: string): Promise<Team | null> {
  return apiGet<Team>(`/api/teams/${encodeURIComponent(id)}`);
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
  return apiGet<Team>(`/api/teams/${encodeURIComponent(slug)}`);
}

export async function listPlayers(filter?: {
  gameId?: string;
  teamId?: string;
}): Promise<Player[]> {
  return apiList<Player>("/api/players", {
    gameId: filter?.gameId,
    teamId: filter?.teamId,
  });
}

export async function getPlayerById(id: string): Promise<Player | null> {
  return apiGet<Player>(`/api/players/${encodeURIComponent(id)}`);
}

/* ── Shop ───────────────────────────────────────────────────────────────── */

export async function listProducts(filter?: {
  category?: Product["category"];
  teamId?: string;
  featured?: boolean;
}): Promise<Product[]> {
  return apiList<Product>("/api/products", {
    category: filter?.category,
    teamId: filter?.teamId,
    featured: filter?.featured === undefined ? undefined : filter.featured ? 1 : 0,
  });
}

export async function getProductById(id: string): Promise<Product | null> {
  return apiGet<Product>(`/api/products/${encodeURIComponent(id)}`);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return apiGet<Product>(`/api/products/${encodeURIComponent(slug)}`);
}
