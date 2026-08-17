"use client";

import Link from "next/link";
import { Calendar, Trophy } from "@/components/icons";
import type { EsportsEvent, Game } from "@/lib/types";

interface UpcomingEventsProps {
  events: EsportsEvent[];
  games: Game[];
  loading: boolean;
}

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
      return "bg-amber-500/25 text-amber-100";
    case "a":
      return "bg-sky-500/25 text-sky-100";
    case "b":
      return "bg-sky-500/25 text-sky-100";
    default:
      return "bg-muted text-foreground/80";
  }
}

function SkeletonCard() {
  return (
    <div className="h-48 w-72 shrink-0 rounded-xl bg-card" />
  );
}

export function UpcomingEvents({ events, games, loading }: UpcomingEventsProps) {
  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Upcoming Events</h2>
        <Link
          href="/events"
          className="text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          See all
        </Link>
      </div>
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No upcoming events scheduled.
        </div>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {events.map((ev) => {
            const game = gameMap.get(ev.gameId);
            const date = new Date(ev.startsAt);
            return (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="group flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={ev.bannerUrl}
                    alt={ev.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <span
                    className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${tierColor(
                      ev.tier
                    )}`}
                  >
                    Tier {ev.tier}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
                    {ev.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    <span className="ml-auto text-sky-400">
                      {game?.shortName}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-amber-300">
                    <Trophy className="h-3.5 w-3.5" />
                    {formatNgn(ev.prizePoolNgn)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default UpcomingEvents;
