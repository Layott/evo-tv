"use client";

import Link from "next/link";
import type { Player, Team } from "@/lib/types";

interface TeamRosterProps {
  team: Team;
  players: Player[];
}

export function TeamRoster({ team, players }: TeamRosterProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex items-center gap-3">
        <img src={team.logoUrl} alt={team.name} className="h-10 w-10 rounded-md border border-neutral-800" />
        <div className="min-w-0 flex-1">
          <Link href={`/team/${team.slug}`} className="block truncate text-sm font-semibold hover:text-sky-400">
            {team.name}
          </Link>
          <p className="text-[11px] text-neutral-400">{team.tag} · #{team.ranking}</p>
        </div>
      </div>
      {players.length === 0 ? (
        <p className="text-xs text-neutral-500">Roster TBA</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {players.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-md bg-neutral-900 p-2">
              <img src={p.avatarUrl} alt={p.handle} className="h-8 w-8 rounded-full border border-neutral-800" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{p.handle}</p>
                <p className="truncate text-[10px] text-neutral-400">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeamRoster;
