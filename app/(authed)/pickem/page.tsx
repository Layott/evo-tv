"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, GitBranch, MapPin, Trophy } from "lucide-react";
import { listEvents } from "@/lib/mock/events";
import { listGames } from "@/lib/mock/games";
import { listMyEntries } from "@/lib/mock/pickem";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function PickemIndexPage() {
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";

  const events = useQuery({
    queryKey: ["pickem", "events", "scheduled"],
    queryFn: () => listEvents({ status: "scheduled" }),
  });
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const myEntries = useQuery({
    queryKey: ["pickem", "my-entries", userId],
    queryFn: () => listMyEntries(userId),
  });

  const gameMap = new Map((games.data ?? []).map((g) => [g.id, g]));
  const entrySet = new Map((myEntries.data ?? []).map((e) => [e.eventId, e]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-50">
          <GitBranch className="h-6 w-6 text-sky-400" /> Pick&apos;em Brackets
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Predict every round before the tournament starts. Score 10 points per correct pick.
        </p>
      </header>

      {(myEntries.data?.length ?? 0) > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Your active brackets</h2>
          <div className="flex flex-wrap gap-2">
            {(myEntries.data ?? []).map((entry) => (
              <Link
                key={entry.id}
                href={`/pickem/${entry.eventId}`}
                className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-500/60"
              >
                Submitted · {entry.score} pts
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-100">Open events</h2>
          <span className="text-xs text-neutral-500">
            {events.data?.length ?? 0} eligible
          </span>
        </div>

        {events.isPending ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl bg-neutral-900" />
            ))}
          </div>
        ) : (events.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
            <GitBranch className="mx-auto h-10 w-10 text-neutral-600" />
            <p className="mt-3 text-sm font-semibold text-neutral-200">No open brackets right now.</p>
            <p className="mt-1 text-xs text-neutral-500">Brackets unlock for any scheduled event.</p>
            <Button asChild variant="outline" className="mt-4 border-neutral-800 bg-neutral-900 hover:bg-neutral-800">
              <Link href="/events">Browse events</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(events.data ?? []).map((ev) => {
              const entry = entrySet.get(ev.id);
              return (
                <Link
                  key={ev.id}
                  href={`/pickem/${ev.id}`}
                  className="group flex overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-sky-500/40"
                >
                  <div className="relative aspect-square w-32 shrink-0 overflow-hidden sm:w-44">
                    <img src={ev.bannerUrl} alt={ev.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    {entry ? (
                      <span className="absolute left-2 top-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-300">
                        Submitted
                      </span>
                    ) : (
                      <span className="absolute left-2 top-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase text-sky-300">
                        Open
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold text-neutral-100 sm:text-base">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-sky-400">{gameMap.get(ev.gameId)?.shortName}</p>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(ev.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {ev.region}
                      </span>
                    </div>
                    <p className="mt-auto flex items-center gap-1 text-xs font-medium text-amber-300">
                      <Trophy className="h-3.5 w-3.5" /> 8-team bracket · 7 picks
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
