"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users, Eye, Clock, Trophy, Calendar, ArrowLeft } from "@/components/icons";
import {
  getGameBySlug,
  listLiveStreams,
  listEvents,
  listTeams,
  listPlayers,
  listVods,
} from "@/lib/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/user-avatar";

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
function formatNgn(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `₦${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K`;
  return `₦${n.toLocaleString()}`;
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Live
    </span>
  );
}

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const gameQ = useQuery({
    queryKey: ["game", slug],
    queryFn: () => getGameBySlug(slug),
  });

  const game = gameQ.data;

  const liveQ = useQuery({
    queryKey: ["streams", "live", game?.id],
    queryFn: () => listLiveStreams({ gameId: game!.id }),
    enabled: !!game,
  });
  const upcomingQ = useQuery({
    queryKey: ["events", "scheduled", game?.id],
    queryFn: () => listEvents({ gameId: game!.id, status: "scheduled" }),
    enabled: !!game,
  });
  const teamsQ = useQuery({
    queryKey: ["teams", game?.id],
    queryFn: () => listTeams({ gameId: game!.id }),
    enabled: !!game,
  });
  const playersQ = useQuery({
    queryKey: ["players", game?.id],
    queryFn: () => listPlayers({ gameId: game!.id }),
    enabled: !!game,
  });
  const vodsQ = useQuery({
    queryKey: ["vods", game?.id],
    queryFn: () => listVods({ gameId: game!.id, limit: 12 }),
    enabled: !!game,
  });

  if (!gameQ.isPending && !game) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Category not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The game you're looking for doesn't exist or was removed.
        </p>
        <Link
          href="/categories"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-sky-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to categories
        </Link>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="h-56 rounded-xl bg-card" />
      </div>
    );
  }

  const live = liveQ.data ?? [];
  const upcoming = upcomingQ.data ?? [];
  const teams = teamsQ.data ?? [];
  const players = playersQ.data ?? [];
  const vods = vodsQ.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="relative mb-6 overflow-hidden rounded-xl border border-border">
        <div className="relative aspect-[16/9] max-h-64 w-full overflow-hidden sm:aspect-[21/9]">
          <img src={game.coverUrl} alt={game.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 sm:p-6">
          <Link
            href="/categories"
            className="mb-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All categories
          </Link>
          <div className="flex items-center gap-3">
            <img
              src={game.iconUrl}
              alt=""
              className="h-12 w-12 rounded-md  object-cover"
            />
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{game.name}</h1>
              <p className="text-xs text-foreground/80">
                {game.shortName} · <span className="capitalize">{game.platform}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-foreground/80">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {formatViewers(game.activePlayers)} active players
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="live">
        <TabsList className="w-full justify-start overflow-x-auto bg-card/60">
          <TabsTrigger value="live">Live ({live.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="teams">Teams ({teams.length})</TabsTrigger>
          <TabsTrigger value="players">Players ({players.length})</TabsTrigger>
          <TabsTrigger value="vods">Past VODs</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          {liveQ.isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-xl bg-card" />
              ))}
            </div>
          ) : live.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No streams live for this game right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {live.map((s) => (
                <Link
                  key={s.id}
                  href={`/stream/${s.id}`}
                  className="group overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img src={s.thumbnailUrl} alt={s.title} className="h-full w-full object-cover" />
                    <div className="absolute left-2 top-2">
                      <LiveBadge />
                    </div>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-paper">
                      <Eye className="h-3 w-3" /> {formatViewers(s.viewerCount)}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold">{s.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{s.streamerName}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          {upcomingQ.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-card" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No upcoming events scheduled for {game.shortName}.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/events/${ev.id}`}
                  className="flex gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors hover:bg-card"
                >
                  <img src={ev.thumbnailUrl} alt={ev.title} className="h-20 w-32 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-sm font-semibold">{ev.title}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(ev.startsAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-300">
                      <Trophy className="h-3 w-3" /> {formatNgn(ev.prizePoolNgn)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          {teamsQ.isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-card" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No teams for {game.shortName}.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/team/${t.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors hover:bg-card"
                >
                  <img src={t.logoUrl} alt={t.name} className="h-12 w-12 rounded-md border border-border" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      #{t.ranking} · {t.wins}-{t.losses}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="players" className="mt-4">
          {playersQ.isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-card" />
              ))}
            </div>
          ) : players.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No players for {game.shortName}.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {players.map((p) => (
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
                    <p className="text-[11px] text-muted-foreground">
                      {p.role} · KDA {p.kda.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vods" className="mt-4">
          {vodsQ.isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-xl bg-card" />
              ))}
            </div>
          ) : vods.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No VODs for {game.shortName} yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {vods.map((v) => (
                <Link
                  key={v.id}
                  href={`/vod/${v.id}`}
                  className="group overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img src={v.thumbnailUrl} alt={v.title} className="h-full w-full object-cover" />
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-paper">
                      <Clock className="h-3 w-3" /> {formatDuration(v.durationSec)}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold">{v.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
