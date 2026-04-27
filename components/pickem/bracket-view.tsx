"use client";

import { Lock, Trophy } from "lucide-react";
import type { Team } from "@/lib/types";
import type { BracketMatch, BracketPick } from "@/lib/mock/pickem";
import { deriveBracketWithPicks } from "@/lib/mock/pickem";

interface Props {
  bracket: BracketMatch[];
  picks: BracketPick[];
  teamMap: Map<string, Team>;
  locked?: boolean;
  onPick?: (matchId: string, teamId: string) => void;
}

const ROUND_TITLES: Record<BracketMatch["round"], string> = {
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

export function BracketView({ bracket, picks, teamMap, locked, onPick }: Props) {
  const filled = deriveBracketWithPicks(bracket, picks);
  const pickMap = new Map(picks.map((p) => [p.matchId, p.winnerTeamId]));

  const grouped = {
    quarterfinal: filled.filter((m) => m.round === "quarterfinal"),
    semifinal: filled.filter((m) => m.round === "semifinal"),
    final: filled.filter((m) => m.round === "final"),
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-10">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((roundKey) => (
          <div key={roundKey} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {ROUND_TITLES[roundKey]}
              </h3>
              <span className="text-[10px] text-neutral-500">{grouped[roundKey].length}</span>
            </div>
            <div className={`flex flex-col ${roundKey === "semifinal" ? "gap-12 sm:gap-16" : roundKey === "final" ? "gap-2 lg:mt-12" : "gap-4"}`}>
              {grouped[roundKey].map((match) => {
                const winner = pickMap.get(match.id) ?? null;
                return (
                  <BracketMatchCard
                    key={match.id}
                    match={match}
                    winner={winner}
                    teamMap={teamMap}
                    locked={locked}
                    onPick={(teamId) => onPick?.(match.id, teamId)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  winner,
  teamMap,
  locked,
  onPick,
}: {
  match: BracketMatch;
  winner: string | null;
  teamMap: Map<string, Team>;
  locked?: boolean;
  onPick?: (teamId: string) => void;
}) {
  const teamA = match.teamAId ? teamMap.get(match.teamAId) : null;
  const teamB = match.teamBId ? teamMap.get(match.teamBId) : null;
  const ready = !!teamA && !!teamB;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <Slot
        team={teamA}
        isWinner={!!winner && winner === teamA?.id}
        muted={!!winner && winner !== teamA?.id}
        clickable={ready && !locked}
        onClick={() => teamA && onPick?.(teamA.id)}
      />
      <div className="border-t border-neutral-800" />
      <Slot
        team={teamB}
        isWinner={!!winner && winner === teamB?.id}
        muted={!!winner && winner !== teamB?.id}
        clickable={ready && !locked}
        onClick={() => teamB && onPick?.(teamB.id)}
      />
      {locked && (
        <div className="flex items-center justify-end gap-1 border-t border-neutral-800 bg-neutral-900/60 px-2 py-1 text-[10px] uppercase text-neutral-500">
          <Lock className="h-3 w-3" /> Locked
        </div>
      )}
    </div>
  );
}

function Slot({
  team,
  isWinner,
  muted,
  clickable,
  onClick,
}: {
  team: Team | null | undefined;
  isWinner: boolean;
  muted: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-600">
        <span className="h-7 w-7 rounded bg-neutral-900" />
        <span>Awaiting pick</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
        isWinner
          ? "bg-sky-500/15"
          : muted
            ? "opacity-50"
            : clickable
              ? "hover:bg-neutral-900"
              : ""
      } ${clickable ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-neutral-800">
        <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
      </div>
      <span className={`flex-1 truncate text-xs font-medium ${isWinner ? "text-sky-200" : "text-neutral-200"}`}>
        {team.name}
      </span>
      <span className="text-[10px] tabular-nums text-neutral-500">[{team.tag}]</span>
      {isWinner && <Trophy className="h-3.5 w-3.5 text-sky-300" />}
    </button>
  );
}
