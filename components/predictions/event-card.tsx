"use client";

import Link from "next/link";
import { Calendar, TrendingUp, Users } from "lucide-react";
import type { PredictionEventSummary } from "@/lib/mock/predictions";
import { CoinPill } from "./coin-pill";

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      Live
    </span>
  );
}

export function PredictionEventCard({
  event,
  gameName,
}: {
  event: PredictionEventSummary;
  gameName?: string;
}) {
  return (
    <Link
      href={`/predictions/${event.eventId}`}
      className="group flex overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-sky-500/40"
    >
      <div className="relative aspect-square w-32 shrink-0 overflow-hidden sm:w-44">
        <img
          src={event.bannerUrl}
          alt={event.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {event.status === "live" && (
          <div className="absolute left-2 top-2">
            <LiveBadge />
          </div>
        )}
        <div className="absolute right-2 top-2">
          <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
            Picks open
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-neutral-100 sm:text-base">
          {event.title}
        </h3>
        {gameName ? <p className="text-xs text-sky-400">{gameName}</p> : null}
        <div className="flex items-center gap-3 text-[11px] text-neutral-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {event.predictionCount.toLocaleString()} picks
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="flex items-center gap-1 text-xs text-neutral-400">
            <TrendingUp className="h-3.5 w-3.5" /> {event.matchesOpen} match{event.matchesOpen === 1 ? "" : "es"}
          </span>
          <CoinPill coins={event.prizePoolCoins} tone="amber" />
        </div>
      </div>
    </Link>
  );
}
