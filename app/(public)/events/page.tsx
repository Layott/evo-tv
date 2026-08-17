"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Trophy } from "@/components/icons";
import { listEvents, listGames } from "@/lib/client";
import type { EsportsEvent, EventTier } from "@/lib/types";

type SortKey = "soonest" | "prize";

function formatNgn(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `₦${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K`;
  return `₦${n.toLocaleString()}`;
}

function tierColor(t: string): string {
  switch (t) {
    case "s":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "a":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "b":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    default:
      return "bg-muted text-foreground/80";
  }
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Live
    </span>
  );
}

function EventCard({ event, gameName }: { event: EsportsEvent; gameName?: string }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
    >
      <div className="relative aspect-square w-32 shrink-0 overflow-hidden sm:w-48">
        <img src={event.bannerUrl} alt={event.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <span
          className={`absolute left-2 top-2 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tierColor(event.tier)}`}
        >
          {event.tier.toUpperCase()}
        </span>
        {event.status === "live" && (
          <div className="absolute left-2 top-9">
            <LiveBadge />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground sm:text-base">
          {event.title}
        </h3>
        <p className="text-xs text-sky-400">{gameName}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {event.region}
          </span>
        </div>
        <p className="mt-auto flex items-center gap-1 text-sm font-semibold text-amber-300">
          <Trophy className="h-3.5 w-3.5" /> {formatNgn(event.prizePoolNgn)}
        </p>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return <div className="h-28 rounded-xl bg-card sm:h-36" />;
}

export default function EventsPage() {
  const [gameFilter, setGameFilter] = React.useState<string | null>(null);
  const [tierFilter, setTierFilter] = React.useState<EventTier | null>(null);
  const [sort, setSort] = React.useState<SortKey>("soonest");

  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const events = useQuery({
    queryKey: ["events", "all", gameFilter],
    queryFn: () => listEvents(gameFilter ? { gameId: gameFilter } : undefined),
  });

  const gameMap = new Map((games.data ?? []).map((g) => [g.id, g]));
  const all = (events.data ?? []).filter((e) => (tierFilter ? e.tier === tierFilter : true));

  const sortEvents = (arr: EsportsEvent[]) => {
    const copy = [...arr];
    if (sort === "prize") copy.sort((a, b) => b.prizePoolNgn - a.prizePoolNgn);
    else copy.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return copy;
  };

  const live = sortEvents(all.filter((e) => e.status === "live"));
  const upcoming = sortEvents(all.filter((e) => e.status === "scheduled"));
  const past = sortEvents(all.filter((e) => e.status === "completed"));

  const renderGrid = (arr: EsportsEvent[]) => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {arr.map((ev) => (
        <EventCard key={ev.id} event={ev} gameName={gameMap.get(ev.gameId)?.shortName} />
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tournaments and invitationals across African esports.
        </p>
      </header>

      <div className="mb-6 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Tier:</span>
          {(["s", "a", "b", "c"] as EventTier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(tierFilter === t ? null : t)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase transition-colors ${
                tierFilter === t
                  ? tierColor(t)
                  : "bg-card/70 text-muted-foreground hover:bg-card"
              }`}
            >
              {t}
            </button>
          ))}

          <span className="ml-auto text-xs text-muted-foreground">Sort:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border bg-card/60 px-2 py-1 text-xs text-foreground focus:border-sky-500/50 focus:outline-none"
          >
            <option value="soonest">Soonest</option>
            <option value="prize">Prize pool</option>
          </select>
        </div>
      </div>

      {events.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No events match your filters.
        </div>
      ) : (
        <div className="space-y-10">
          {live.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <LiveBadge /> Happening now
              </h2>
              {renderGrid(live)}
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">Upcoming</h2>
              {renderGrid(upcoming)}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">Past events</h2>
              {renderGrid(past)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
