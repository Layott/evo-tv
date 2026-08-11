"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import {
  getLeagueById,
  getLineup,
  listAvailablePlayers,
  playerCost,
  submitLineup,
} from "@/lib/mock/fantasy";
import type { Player } from "@/lib/types";
import { useAuth } from "@/components/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { CoinPill, formatCoins } from "@/components/predictions/coin-pill";

const ROSTER_SIZE = 5;

export default function FantasyLineupPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "user_current";
  const [refreshKey, setRefreshKey] = React.useState(0);

  const league = useQuery({
    queryKey: ["fantasy", "league", id],
    queryFn: () => getLeagueById(id),
  });
  const playersQ = useQuery({
    queryKey: ["fantasy", "available", league.data?.gameId],
    enabled: !!league.data?.gameId,
    queryFn: () => listAvailablePlayers(league.data!.gameId),
  });
  const existing = useQuery({
    queryKey: ["fantasy", "lineup", id, userId, refreshKey],
    queryFn: () => getLineup(id, userId),
  });

  const [search, setSearch] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (existing.data?.players) {
      setPicked(existing.data.players.map((p) => p.playerId));
    }
  }, [existing.data?.id, existing.data?.players]);

  if (league.isFetched && !league.data) notFound();
  const lg = league.data;

  const allPlayers = playersQ.data ?? [];
  const playerById = React.useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers],
  );
  const filtered = React.useMemo(() => {
    let list = allPlayers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.handle.toLowerCase().includes(q) || p.realName.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => playerCost(b) - playerCost(a));
  }, [allPlayers, search]);

  const totalCost = picked.reduce((sum, pid) => sum + (playerById.get(pid) ? playerCost(playerById.get(pid)!) : 0), 0);
  const remaining = (lg?.salaryCap ?? 0) - totalCost;
  const overCap = remaining < 0;
  const canSubmit = picked.length === ROSTER_SIZE && !overCap;

  function togglePick(p: Player) {
    setPicked((prev) => {
      if (prev.includes(p.id)) return prev.filter((x) => x !== p.id);
      if (prev.length >= ROSTER_SIZE) {
        toast.error(`Roster is full (${ROSTER_SIZE} players).`);
        return prev;
      }
      const cost = playerCost(p);
      const futureCost = totalCost + cost;
      if (lg && futureCost > lg.salaryCap) {
        toast.error(`Adding ${p.handle} would exceed your salary cap.`);
        return prev;
      }
      return [...prev, p.id];
    });
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const res = await submitLineup(id, picked, userId);
    setSubmitting(false);
    if (res.ok) {
      toast.success(`Lineup locked in! Projected: ${res.lineup.totalPoints} points.`);
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href={`/fantasy/leagues/${id}`}>
          <ArrowLeft className="h-4 w-4" /> Back to league
        </Link>
      </Button>

      {!lg ? (
        <Skeleton className="h-44 w-full rounded-xl bg-neutral-900" />
      ) : (
        <>
          <header className="mb-6">
            <p className="text-xs uppercase tracking-wider text-sky-400">{lg.name}</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-50">Build your lineup</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Pick {ROSTER_SIZE} players under the {formatCoins(lg.salaryCap)} salary cap.
            </p>
          </header>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Mini label="Roster" value={`${picked.length} / ${ROSTER_SIZE}`} />
            <Mini label="Salary cap" value={formatCoins(lg.salaryCap)} />
            <Mini
              label={overCap ? "Over cap" : "Remaining"}
              value={`${overCap ? "-" : ""}${Math.abs(remaining).toLocaleString()} coins`}
              tone={overCap ? "red" : remaining < 1500 ? "amber" : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section>
              <div className="mb-3 flex items-center gap-3">
                <Input
                  placeholder="Search by handle or real name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-neutral-800 bg-neutral-900"
                />
                <span className="shrink-0 text-xs text-neutral-500">{filtered.length} players</span>
              </div>

              {playersQ.isPending ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg bg-neutral-900" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
                  <p className="text-sm text-neutral-400">No players match your search.</p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filtered.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      picked={picked.includes(p.id)}
                      onClick={() => togglePick(p)}
                    />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
                  <Trophy className="h-4 w-4 text-amber-300" /> Your roster
                </h3>
                <div className="mt-3 space-y-2">
                  {Array.from({ length: ROSTER_SIZE }).map((_, slotIdx) => {
                    const pid = picked[slotIdx];
                    const player = pid ? playerById.get(pid) : null;
                    if (!player) {
                      return (
                        <div
                          key={slotIdx}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 px-2 py-2 text-xs text-neutral-500"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900">
                            <Plus className="h-3 w-3" />
                          </span>
                          Slot {slotIdx + 1}
                        </div>
                      );
                    }
                    const cost = playerCost(player);
                    return (
                      <div
                        key={slotIdx}
                        className="group flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-2 py-2"
                      >
                        <Avatar className="h-7 w-7 border border-neutral-800">
                          <AvatarImage src={player.avatarUrl} alt={player.handle} />
                          <AvatarFallback>{player.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-neutral-100">{player.handle}</p>
                          <p className="text-[10px] text-neutral-400">{player.role} · KDA {player.kda.toFixed(2)}</p>
                        </div>
                        <CoinPill coins={cost} tone="muted" />
                        <button
                          type="button"
                          onClick={() => setPicked((prev) => prev.filter((x) => x !== player.id))}
                          className="ml-1 rounded p-1 text-neutral-500 hover:bg-red-500/10 hover:text-red-300"
                          aria-label={`Remove ${player.handle}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Total spend</span>
                  <CoinPill coins={totalCost} tone="amber" />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Cap remaining</span>
                  <span className={`font-semibold tabular-nums ${overCap ? "text-red-300" : "text-emerald-300"}`}>
                    {overCap ? "-" : ""}{Math.abs(remaining).toLocaleString()}
                  </span>
                </div>
                <Button
                  className="mt-4 w-full bg-sky-600 text-white hover:bg-sky-500"
                  size="sm"
                  disabled={!canSubmit || submitting}
                  onClick={onSubmit}
                >
                  {submitting ? "Submitting..." : existing.data ? "Update lineup" : "Submit lineup"}
                </Button>
                {!canSubmit && (
                  <p className="mt-2 text-[10px] text-neutral-500">
                    {picked.length < ROSTER_SIZE
                      ? `Pick ${ROSTER_SIZE - picked.length} more player${ROSTER_SIZE - picked.length === 1 ? "" : "s"}.`
                      : "Trim your roster to fit the salary cap."}
                  </p>
                )}
              </div>

              {existing.data && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                  Last submitted lineup scored <span className="font-bold">{existing.data.totalPoints} pts</span>.
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  picked,
  onClick,
}: {
  player: Player;
  picked: boolean;
  onClick: () => void;
}) {
  const cost = playerCost(player);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition ${
        picked
          ? "border-sky-500/50 bg-sky-500/10"
          : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
      }`}
    >
      <Avatar className="h-9 w-9 border border-neutral-800">
        <AvatarImage src={player.avatarUrl} alt={player.handle} />
        <AvatarFallback>{player.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-neutral-100">{player.handle}</p>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] uppercase text-neutral-300">{player.role}</span>
        </div>
        <p className="text-[11px] text-neutral-400">KDA {player.kda.toFixed(2)} · {player.followers.toLocaleString()} followers</p>
      </div>
      <div className="flex flex-col items-end">
        <CoinPill coins={cost} tone={picked ? "amber" : "muted"} />
        <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${picked ? "text-sky-300" : "text-neutral-500"}`}>
          {picked ? "Picked" : "Tap to pick"}
        </span>
      </div>
    </button>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "red";
}) {
  return (
    <div
      className={`rounded-xl border bg-neutral-900/60 p-3 ${
        tone === "amber" ? "border-amber-500/30" : tone === "red" ? "border-red-500/30" : "border-neutral-800"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-base font-semibold tabular-nums ${
          tone === "amber" ? "text-amber-300" : tone === "red" ? "text-red-300" : "text-neutral-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
