"use client";

import Link from "next/link";
import type { Player, Team } from "@/lib/types";
import { UserAvatar } from "@/components/ui/user-avatar";

interface TeamRosterProps {
  team: Team;
  players: Player[];
}

export function TeamRoster({ team, players }: TeamRosterProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center gap-3">
        <img src={team.logoUrl} alt={team.name} className="h-10 w-10 rounded-md border border-border" />
        <div className="min-w-0 flex-1">
          <Link href={`/team/${team.slug}`} className="block truncate text-sm font-semibold hover:text-sky-400">
            {team.name}
          </Link>
          <p className="text-[11px] text-muted-foreground">{team.tag} · #{team.ranking}</p>
        </div>
      </div>
      {players.length === 0 ? (
        <p className="text-xs text-muted-foreground">Roster TBA</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {players.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-md bg-card p-2">
              <UserAvatar
                src={p.avatarUrl}
                handle={p.handle}
                seed={p.id}
                decorative
                className="h-8 w-8 shrink-0"
                textClassName="text-[10px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{p.handle}</p>
                <p className="truncate text-[10px] text-muted-foreground">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeamRoster;
