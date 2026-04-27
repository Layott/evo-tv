"use client";

import Link from "next/link";
import { Calendar, Users } from "lucide-react";
import type { FantasyLeague } from "@/lib/mock/fantasy";
import { CoinPill } from "@/components/predictions/coin-pill";

const STATUS_TONE: Record<FantasyLeague["status"], string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  drafting: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  completed: "border-neutral-700 bg-neutral-800 text-neutral-300",
};

export function LeagueCard({
  league,
  gameName,
  bannerUrl,
  isMember,
}: {
  league: FantasyLeague;
  gameName?: string;
  bannerUrl: string;
  isMember?: boolean;
}) {
  const remaining = Math.max(0, league.maxMembers - league.members.length);
  return (
    <Link
      href={`/fantasy/leagues/${league.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-sky-500/40"
    >
      <div className="relative aspect-[16/8] w-full overflow-hidden">
        <img src={bannerUrl} alt={league.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />
        <span className={`absolute left-2 top-2 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_TONE[league.status]}`}>
          {league.status}
        </span>
        {isMember && (
          <span className="absolute right-2 top-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Member
          </span>
        )}
        <div className="absolute inset-x-3 bottom-2">
          <h3 className="line-clamp-2 text-base font-bold text-neutral-50 sm:text-lg">{league.name}</h3>
          {gameName && <p className="text-xs text-sky-300">{gameName}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-neutral-800/60 bg-neutral-900/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {league.members.length} / {league.maxMembers}
            {remaining > 0 && league.status === "active" ? (
              <span className="text-emerald-300">· {remaining} open</span>
            ) : null}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Ends {new Date(league.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
        <CoinPill coins={league.prizePool} tone="amber" />
      </div>
    </Link>
  );
}
