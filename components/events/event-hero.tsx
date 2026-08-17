"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Trophy } from "lucide-react";
import type { EsportsEvent, Game } from "@/lib/types";

interface EventHeroProps {
  event: EsportsEvent;
  game?: Game | null;
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
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "a":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "b":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    default:
      return "bg-muted text-foreground/80";
  }
}

export function EventHero({ event, game }: EventHeroProps) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-border">
      <div className="relative aspect-[16/9] max-h-72 w-full overflow-hidden sm:aspect-[21/9]">
        <img src={event.bannerUrl} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:p-6">
        <Link
          href="/events"
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tierColor(
              event.tier
            )}`}
          >
            Tier {event.tier}
          </span>
          {event.status === "live" && (
            <span className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Live now
            </span>
          )}
          {event.status === "completed" && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Concluded
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight text-white sm:text-4xl">
          {event.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground/80">
          {game && <span className="text-sky-400">{game.name}</span>}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {start.toLocaleDateString()} - {end.toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.region}
          </span>
          <span className="flex items-center gap-1 font-semibold text-amber-300">
            <Trophy className="h-3 w-3" /> {formatNgn(event.prizePoolNgn)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default EventHero;
