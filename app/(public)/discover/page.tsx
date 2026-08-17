"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Eye, Users, UserRound, Clock } from "@/components/icons";
import {
  globalSearch,
  searchSuggestions,
  listGames,
  listLiveStreams,
  listVods,
  listTeams,
  listPlayers,
} from "@/lib/client";
import { MediaImage } from "@/components/ui/media-image";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/user-avatar";

type ContentType = "all" | "streams" | "vods" | "teams" | "players";

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Live
    </span>
  );
}

function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function DiscoverPage() {
  const [query, setQuery] = React.useState("");
  const debounced = useDebounced(query, 200);
  const [gameFilter, setGameFilter] = React.useState<string | null>(null);
  const [contentFilter, setContentFilter] = React.useState<ContentType>("all");
  const [showSuggest, setShowSuggest] = React.useState(false);

  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });

  const suggestionsQ = useQuery({
    queryKey: ["search", "suggestions", debounced],
    queryFn: () => searchSuggestions(debounced, 8),
    enabled: debounced.length > 0,
  });

  const resultsQ = useQuery({
    queryKey: ["search", "results", debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.length > 0,
  });

  const liveQ = useQuery({
    queryKey: ["streams", "live", gameFilter],
    queryFn: () => listLiveStreams(gameFilter ? { gameId: gameFilter } : undefined),
    enabled: debounced.length === 0,
  });
  const vodsQ = useQuery({
    queryKey: ["vods", "all", gameFilter],
    queryFn: () => listVods(gameFilter ? { gameId: gameFilter, limit: 20 } : { limit: 20 }),
    enabled: debounced.length === 0,
  });
  const teamsQ = useQuery({
    queryKey: ["teams", gameFilter],
    queryFn: () => listTeams(gameFilter ? { gameId: gameFilter } : undefined),
    enabled: debounced.length === 0,
  });
  const playersQ = useQuery({
    queryKey: ["players", gameFilter],
    queryFn: () => listPlayers(gameFilter ? { gameId: gameFilter } : undefined),
    enabled: debounced.length === 0,
  });

  const gameMap = new Map((games.data ?? []).map((g) => [g.id, g]));

  const streams = debounced ? resultsQ.data?.streams ?? [] : liveQ.data ?? [];
  const vods = debounced ? resultsQ.data?.vods ?? [] : vodsQ.data ?? [];
  const teams = debounced ? resultsQ.data?.teams ?? [] : teamsQ.data ?? [];
  const players = debounced ? resultsQ.data?.players ?? [] : playersQ.data ?? [];

  const totalResults = streams.length + vods.length + teams.length + players.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            placeholder="Search streams, events, teams, players…"
            className="w-full rounded-xl border border-border bg-card/60 py-3 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-sky-500/50 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {showSuggest && debounced && (suggestionsQ.data ?? []).length > 0 && (
            <div className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
              {suggestionsQ.data!.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(s);
                    setShowSuggest(false);
                  }}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm text-foreground hover:bg-accent last:border-0"
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setGameFilter(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              gameFilter === null
                ? "bg-sky-500/25 text-sky-100"
                : "bg-card/70 text-muted-foreground hover:bg-card"
            }`}
          >
            All games
          </button>
          {(games.data ?? []).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGameFilter(g.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                gameFilter === g.id
                  ? "bg-sky-500/25 text-sky-100"
                  : "bg-card/70 text-muted-foreground hover:bg-card"
              }`}
            >
              {g.shortName}
            </button>
          ))}
          <div className="mx-2 h-6 w-px self-center bg-muted" />
          {(["all", "streams", "vods", "teams", "players"] as ContentType[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setContentFilter(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                contentFilter === c
                  ? "bg-sky-500/25 text-sky-100"
                  : "bg-card/70 text-muted-foreground hover:bg-card"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {debounced && totalResults === 0 && !resultsQ.isPending ? (
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center">
          <p className="text-sm text-foreground/80">No results for "{debounced}".</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Try searching for a game, team tag (e.g., ALPHA), player handle, or event.
          </p>
        </div>
      ) : (
        <Tabs value={contentFilter} onValueChange={(v) => setContentFilter(v as ContentType)}>
          <TabsList className="mb-4 hidden">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="streams">Streams</TabsTrigger>
            <TabsTrigger value="vods">VODs</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
          </TabsList>

          {(contentFilter === "all" || contentFilter === "streams") && streams.length > 0 && (
            <section className="mb-8 space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">Streams</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {streams.map((s) => {
                  const game = s.gameId ? gameMap.get(s.gameId) : undefined;
                  return (
                    <Link
                      key={s.id}
                      href={`/stream/${s.id}`}
                      className="group overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
                    >
                      <div className="relative aspect-video overflow-hidden">
                        <MediaImage
                          src={s.thumbnailUrl}
                          alt={s.title}
                          seed={s.id}
                          className="h-full w-full object-cover"
                        />
                        {s.isLive && (
                          <div className="absolute left-2 top-2">
                            <LiveBadge />
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-foreground">
                          <Eye className="h-3 w-3" /> {formatViewers(s.viewerCount)}
                        </div>
                      </div>
                      <div className="space-y-1 p-3">
                        <h3 className="line-clamp-2 text-sm font-semibold">{s.title}</h3>
                        <p className="text-xs text-muted-foreground">{s.streamerName}</p>
                        {game && <p className="text-[11px] text-sky-400">{game.shortName}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {(contentFilter === "all" || contentFilter === "vods") && vods.length > 0 && (
            <section className="mb-8 space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">VODs</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {vods.map((v) => {
                  const game = v.gameId ? gameMap.get(v.gameId) : undefined;
                  return (
                    <Link
                      key={v.id}
                      href={`/vod/${v.id}`}
                      className="group overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
                    >
                      <div className="relative aspect-video overflow-hidden">
                        <MediaImage
                          src={v.thumbnailUrl}
                          alt={v.title}
                          seed={v.id}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-foreground">
                          <Clock className="h-3 w-3" /> {formatDuration(v.durationSec)}
                        </div>
                      </div>
                      <div className="space-y-1 p-3">
                        <h3 className="line-clamp-2 text-sm font-semibold">{v.title}</h3>
                        {game && <p className="text-[11px] text-sky-400">{game.shortName}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {(contentFilter === "all" || contentFilter === "teams") && teams.length > 0 && (
            <section className="mb-8 space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">Teams</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {teams.map((t) => {
                  const game = gameMap.get(t.gameId);
                  return (
                    <Link
                      key={t.id}
                      href={`/team/${t.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors hover:bg-card"
                    >
                      <img
                        src={t.logoUrl}
                        alt={t.name}
                        className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.tag} · {game?.shortName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <Users className="mr-1 inline h-3 w-3" />
                          {formatViewers(t.followers)} followers
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {(contentFilter === "all" || contentFilter === "players") && players.length > 0 && (
            <section className="mb-8 space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">Players</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {players.slice(0, 20).map((p) => {
                  const game = gameMap.get(p.gameId);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
                    >
                      <UserAvatar
                        src={p.avatarUrl}
                        handle={p.handle}
                        seed={p.id}
                        decorative
                        className="h-12 w-12 shrink-0"
                        textClassName="text-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.handle}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {p.role} · {game?.shortName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <UserRound className="mr-1 inline h-3 w-3" />
                          KDA {p.kda.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </Tabs>
      )}
    </div>
  );
}
