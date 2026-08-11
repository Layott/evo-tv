"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Lock, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  getBracketForEvent,
  getMyEntryForEvent,
  submitPickemEntry,
  type BracketPick,
  deriveBracketWithPicks,
} from "@/lib/mock/pickem";
import { getEventById } from "@/lib/mock/events";
import { listTeams } from "@/lib/mock/teams";
import { listGames } from "@/lib/mock/games";
import { useAuth } from "@/components/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BracketView } from "@/components/pickem/bracket-view";

export default function PickemBracketPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "user_current";
  const router = useRouter();

  const [picks, setPicks] = React.useState<BracketPick[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const event = useQuery({
    queryKey: ["pickem", "event", eventId],
    queryFn: () => getEventById(eventId),
  });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => listTeams() });
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const bracket = useQuery({
    queryKey: ["pickem", "bracket", eventId],
    queryFn: () => getBracketForEvent(eventId),
  });
  const existing = useQuery({
    queryKey: ["pickem", "my-entry", eventId, userId, refreshKey],
    queryFn: () => getMyEntryForEvent(eventId, userId),
  });

  // Hydrate picks from existing entry (read-only) once it loads
  React.useEffect(() => {
    if (existing.data) setPicks(existing.data.picks);
  }, [existing.data]);

  if (event.isFetched && !event.data) notFound();

  const teamMap = React.useMemo(
    () => new Map((teams.data ?? []).map((t) => [t.id, t])),
    [teams.data],
  );
  const ev = event.data;
  const gameName = (games.data ?? []).find((g) => g.id === ev?.gameId)?.shortName;

  const locked = !!existing.data;
  const totalSlots = bracket.data?.length ?? 0;
  const completed = picks.length;

  function onPick(matchId: string, teamId: string) {
    if (locked) return;
    setPicks((prev) => {
      const without = prev.filter((p) => p.matchId !== matchId);
      const next = [...without, { matchId, winnerTeamId: teamId }];
      // Wipe downstream picks if a QF was changed - re-derive and drop any pick whose team is no longer in the slot
      if (!bracket.data) return next;
      const filled = deriveBracketWithPicks(bracket.data, next);
      // For each pick, if the match's slot teams don't include the picked team, remove it
      return next.filter((p) => {
        const slot = filled.find((m) => m.id === p.matchId);
        if (!slot) return true;
        if (slot.teamAId === p.winnerTeamId || slot.teamBId === p.winnerTeamId) return true;
        // Team no longer reachable; drop pick
        return false;
      });
    });
  }

  async function onSubmit() {
    if (!bracket.data) return;
    if (picks.length < bracket.data.length) {
      toast.error(`Pick all ${bracket.data.length} matches before submitting.`);
      return;
    }
    setSubmitting(true);
    const res = await submitPickemEntry(eventId, picks, userId);
    setSubmitting(false);
    if (res.ok) {
      toast.success(`Bracket locked! Score: ${res.entry.score} pts.`);
      setRefreshKey((k) => k + 1);
      router.push(`/pickem/${eventId}/leaderboard`);
    } else {
      toast.error(res.error);
    }
  }

  const filled = bracket.data ? deriveBracketWithPicks(bracket.data, picks) : [];
  const finalMatch = filled.find((m) => m.round === "final");
  const championPick = picks.find((p) => p.matchId === finalMatch?.id);
  const champion = championPick ? teamMap.get(championPick.winnerTeamId) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href="/pickem">
          <ArrowLeft className="h-4 w-4" /> Back to brackets
        </Link>
      </Button>

      {event.isPending || !ev || bracket.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl bg-neutral-900" />
          <Skeleton className="h-72 w-full rounded-xl bg-neutral-900" />
        </div>
      ) : (
        <>
          <header className="mb-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <div className="relative aspect-[3/1] w-full overflow-hidden">
              <img src={ev.bannerUrl} alt={ev.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            </div>
            <div className="space-y-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                  Bracket Pick&apos;em
                </span>
                {gameName && <span className="text-sky-400">{gameName}</span>}
                {locked && (
                  <span className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                    <Lock className="h-3 w-3" /> Submitted · {existing.data!.score} pts
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-neutral-50 sm:text-2xl">{ev.title}</h1>
              <p className="line-clamp-2 text-sm text-neutral-400">{ev.description}</p>
            </div>
          </header>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Mini label="Picks made" value={`${completed} / ${totalSlots}`} />
            <Mini
              label="Your champion"
              value={champion ? champion.name : "—"}
            />
            <Mini label="Score per correct" value="10 pts" tone="amber" />
          </div>

          <BracketView
            bracket={bracket.data!}
            picks={picks}
            teamMap={teamMap}
            locked={locked}
            onPick={onPick}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
            <p className="text-xs text-neutral-400">
              {locked
                ? "Your bracket is locked. Watch the leaderboard for live scoring."
                : `Pick a winner for every match. Once submitted you cannot change picks.`}
            </p>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800">
                <Link href={`/pickem/${eventId}/leaderboard`}>
                  <Crown className="h-4 w-4" /> Leaderboard
                </Link>
              </Button>
              {!locked && (
                <Button
                  onClick={onSubmit}
                  disabled={submitting || completed < totalSlots}
                  className="bg-sky-600 text-white hover:bg-sky-500"
                  size="sm"
                >
                  <Trophy className="h-4 w-4" />
                  {submitting ? "Submitting..." : `Submit bracket (${completed}/${totalSlots})`}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div
      className={`rounded-xl border bg-neutral-900/60 p-3 ${
        tone === "amber" ? "border-amber-500/20" : "border-neutral-800"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone === "amber" ? "text-amber-300" : "text-neutral-100"}`}>
        {value}
      </p>
    </div>
  );
}
