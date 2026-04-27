"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, BellOff, Trophy, Users, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  getTeamBySlug,
  getGameById,
  listPlayers,
  listMatchesForEvent,
  listEvents,
} from "@/lib/mock";
import { useMockAuth } from "@/components/providers";
import type { Match } from "@/lib/types";

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function TeamDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { toggleFollow, isFollowing } = useMockAuth();

  const teamQ = useQuery({
    queryKey: ["team", slug],
    queryFn: () => getTeamBySlug(slug),
  });
  const team = teamQ.data;

  const gameQ = useQuery({
    queryKey: ["game", team?.gameId],
    queryFn: () => getGameById(team!.gameId),
    enabled: !!team,
  });

  const rosterQ = useQuery({
    queryKey: ["players", "team", team?.id],
    queryFn: () => listPlayers({ teamId: team!.id }),
    enabled: !!team,
  });

  const eventsQ = useQuery({
    queryKey: ["events", "team", team?.gameId],
    queryFn: () => listEvents({ gameId: team!.gameId }),
    enabled: !!team,
  });

  const teamEvents = (eventsQ.data ?? []).filter((e) => e.teamIds.includes(team?.id ?? ""));

  const matchesQ = useQuery({
    queryKey: ["matches", "team", team?.id, teamEvents.map((e) => e.id).join(",")],
    queryFn: async () => {
      const arrays = await Promise.all(teamEvents.map((e) => listMatchesForEvent(e.id)));
      return arrays.flat().filter((m) => m.teamAId === team?.id || m.teamBId === team?.id);
    },
    enabled: !!team && teamEvents.length > 0,
  });

  if (!teamQ.isPending && !team) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Team not found</h1>
        <Link
          href="/team"
          className="mt-6 inline-flex rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-sky-400"
        >
          Back to teams
        </Link>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="h-56 animate-pulse rounded-xl bg-neutral-900" />
      </div>
    );
  }

  const following = isFollowing("team", team.id);
  const onFollow = () => {
    toggleFollow("team", team.id);
    toast.success(following ? `Unfollowed ${team.name}` : `Following ${team.name}`);
  };

  const winRate = team.wins + team.losses === 0 ? 0 : Math.round((team.wins / (team.wins + team.losses)) * 100);
  const roster = rosterQ.data ?? [];
  const allMatches = (matchesQ.data ?? []) as Match[];
  const upcoming = allMatches.filter((m) => m.state === "scheduled" || m.state === "live");
  const past = allMatches.filter((m) => m.state === "completed");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="relative mb-6 overflow-hidden rounded-xl border border-neutral-800">
        <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-sky-500/20 via-neutral-900 to-neutral-950">
          <img src={team.logoUrl} alt="" className="h-full w-full object-contain opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <Link
            href="/team"
            className="mb-2 inline-flex w-fit items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
          >
            <ArrowLeft className="h-3 w-3" /> All teams
          </Link>
          <div className="flex flex-wrap items-end gap-4">
            <img
              src={team.logoUrl}
              alt={team.name}
              className="h-20 w-20 rounded-xl border-2 border-neutral-900 bg-neutral-900 object-cover sm:h-24 sm:w-24"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{team.name}</h1>
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-sky-300">
                  {team.tag}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {team.country} · {team.region}
                </span>
                <span className="flex items-center gap-1 text-sky-400">{gameQ.data?.name}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onFollow}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
                following
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                  : "border-transparent bg-sky-500 text-neutral-950 hover:bg-sky-400"
              }`}
            >
              {following ? <Bell className="h-4 w-4 fill-sky-300" /> : <BellOff className="h-4 w-4" />}
              {following ? "Following" : "Follow"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Rank</p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold text-amber-300">
            <Trophy className="h-4 w-4" /> #{team.ranking}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">W-L</p>
          <p className="mt-1 text-lg font-bold text-sky-400">
            {team.wins}-{team.losses}
          </p>
          <p className="text-[11px] text-neutral-500">{winRate}% win rate</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Followers</p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold">
            <Users className="h-4 w-4" /> {formatFollowers(team.followers)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Active roster</p>
          <p className="mt-1 text-lg font-bold">{roster.length}</p>
        </div>
      </div>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Roster</h2>
        {rosterQ.isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-900" />
            ))}
          </div>
        ) : roster.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-sm text-neutral-500">
            Roster not yet announced.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
                <img src={p.avatarUrl} alt={p.handle} className="h-12 w-12 rounded-full border border-neutral-800" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.handle}</p>
                  <p className="truncate text-[11px] text-neutral-400">{p.realName}</p>
                  <p className="mt-0.5 text-[11px] text-sky-400">
                    {p.role} · KDA {p.kda.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Upcoming matches</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-sm text-neutral-500">
            No scheduled matches.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm"
              >
                <Calendar className="h-4 w-4 text-sky-400" />
                <span className="font-medium">{m.round}</span>
                <span className="text-neutral-500">Bo{m.bestOf}</span>
                <span className="ml-auto text-xs text-neutral-400">
                  {new Date(m.scheduledAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Past matches</h2>
        {past.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-sm text-neutral-500">
            No past matches recorded.
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((m) => {
              const teamIsA = m.teamAId === team.id;
              const ourScore = teamIsA ? m.scoreA : m.scoreB;
              const theirScore = teamIsA ? m.scoreB : m.scoreA;
              const won = ourScore > theirScore;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm"
                >
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      won ? "bg-sky-500/10 text-sky-300" : "bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {won ? "W" : "L"}
                  </span>
                  <span className="font-medium">{m.round}</span>
                  <span className="ml-auto tabular-nums">
                    {ourScore} – {theirScore}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
