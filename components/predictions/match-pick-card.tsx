"use client";

import * as React from "react";
import { Lock, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Match, Team } from "@/lib/types";
import type { Prediction } from "@/lib/mock/predictions";
import { getTeamOdds, submitPrediction } from "@/lib/mock/predictions";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CoinPill } from "./coin-pill";

interface Props {
  match: Match;
  teamA: Team | null;
  teamB: Team | null;
  existing: Prediction | null;
  coinBalance: number;
  onSubmitted: () => void;
}

export function MatchPickCard({ match, teamA, teamB, existing, coinBalance, onSubmitted }: Props) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [stake, setStake] = React.useState(100);
  const [submitting, setSubmitting] = React.useState(false);

  const locked = !!existing || match.state === "completed";
  const oddsA = teamA && teamB ? getTeamOdds(teamA.id, teamB.id) : 2.0;
  const oddsB = teamA && teamB ? getTeamOdds(teamB.id, teamA.id) : 2.0;

  const pickedTeamId = existing?.teamPickedId ?? selected;
  const odds = pickedTeamId === teamA?.id ? oddsA : pickedTeamId === teamB?.id ? oddsB : 0;
  const potential = pickedTeamId
    ? Math.round((existing?.coinsStaked ?? stake) * odds)
    : 0;

  async function onSubmit() {
    if (!selected) {
      toast.error("Select a team to pick.");
      return;
    }
    setSubmitting(true);
    const res = await submitPrediction(match.id, selected, stake);
    setSubmitting(false);
    if (res.ok) {
      toast.success(`Picked! Potential payout ${res.prediction.payoutCoins.toLocaleString()} coins.`);
      onSubmitted();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {match.round}
        </span>
        <div className="flex items-center gap-2">
          {match.state === "live" && (
            <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              Live · {match.scoreA}-{match.scoreB}
            </span>
          )}
          {locked && (
            <span className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] uppercase text-neutral-300">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {[teamA, teamB].map((team, i) => {
          if (!team) return null;
          const teamOdds = i === 0 ? oddsA : oddsB;
          const isSelected = pickedTeamId === team.id;
          const isCorrect = existing && existing.status !== "open" && existing.teamPickedId === team.id;
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => !locked && setSelected(team.id)}
              disabled={locked}
              aria-pressed={isSelected}
              className={`group relative flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                isSelected
                  ? existing?.status === "won"
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : existing?.status === "lost"
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-sky-500/50 bg-sky-500/10"
                  : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
              } ${locked ? "cursor-not-allowed" : ""}`}
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-neutral-100">{team.name}</span>
                  <span className="text-[10px] text-neutral-500">[{team.tag}]</span>
                </div>
                <p className="text-[11px] text-neutral-400">Rank #{team.ranking} · {team.region}</p>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase text-neutral-500">Odds</span>
                <span className="block text-sm font-bold tabular-nums text-amber-300">{teamOdds.toFixed(2)}x</span>
              </div>
              {isCorrect && (
                <span className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-neutral-950">
                  <Trophy className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {locked ? (
        <div className="border-t border-neutral-800 bg-neutral-900/40 px-4 py-3 text-xs">
          {existing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-neutral-400">
                You staked <CoinPill coins={existing.coinsStaked} tone="muted" className="ml-1" />
              </span>
              {existing.status === "open" ? (
                <span className="text-sky-300">
                  Pending · potential payout <CoinPill coins={existing.payoutCoins} tone="amber" className="ml-1" />
                </span>
              ) : existing.status === "won" ? (
                <span className="text-emerald-300">Won · payout {existing.payoutCoins.toLocaleString()} coins</span>
              ) : (
                <span className="text-red-300">Lost</span>
              )}
            </div>
          ) : (
            <span className="text-neutral-500">Picks closed for this match.</span>
          )}
        </div>
      ) : (
        <div className="space-y-3 border-t border-neutral-800 bg-neutral-900/40 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Your stake</span>
            <CoinPill coins={stake} tone="amber" />
          </div>
          <Slider
            min={50}
            max={Math.max(50, Math.min(500, coinBalance))}
            step={10}
            value={[stake]}
            onValueChange={(v) => setStake(v[0] ?? 50)}
            disabled={coinBalance < 50}
          />
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>Min 50</span>
            <span className="flex items-center gap-1 text-amber-300">
              <Sparkles className="h-3 w-3" /> Potential payout: {potential.toLocaleString()}
            </span>
            <span>Max {Math.min(500, coinBalance).toLocaleString()}</span>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!selected || submitting || coinBalance < stake}
            onClick={onSubmit}
            className="w-full bg-sky-600 text-white hover:bg-sky-500"
          >
            {submitting ? "Submitting..." : selected ? `Lock in pick (${stake} coins)` : "Pick a team"}
          </Button>
        </div>
      )}
    </div>
  );
}
