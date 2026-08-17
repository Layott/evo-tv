"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, BellOff, Trophy, Users, Calendar, MapPin } from "@/components/icons";
import { toast } from "sonner";
import {
  getTeamBySlug,
  getGameById,
  listPlayers,
  listMatchesForEvent,
  listEvents,
} from "@/lib/client";
import { useAuth } from "@/components/providers";
import type { Match } from "@/lib/types";
import { UserAvatar } from "@/components/ui/user-avatar";

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function TeamDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { toggleFollow, isFollowing } = useAuth();

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
          className="mt-6 inline-flex rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-sky-400"
        >
          Back to teams
        </Link>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="h-56 rounded-xl bg-card" />
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
      <div className="relative mb-6 overflow-hidden rounded-xl">
        <div className="relative h-48 w-full overflow-hidden bg-sky-500/15">
          <img src={team.logoUrl} alt="" className="h-full w-full object-contain opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <Link
            href="/team"
            /* Sits on the fixed black scrim, so it takes fixed light type rather
               than the theme's muted token, which goes near-black on paper. */
            className="mb-2 inline-flex w-fit items-center gap-1 text-xs text-paper/70 hover:text-paper"
          >
            <ArrowLeft className="h-3 w-3" /> All teams
          </Link>
          <div className="flex flex-wrap items-end gap-4">
            <img
              src={team.logoUrl}
              alt={team.name}
              className="h-20 w-20 rounded-xl bg-card object-cover sm:h-24 sm:w-24"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{team.name}</h1>
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-sky-300">
                  {team.tag}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-paper/70">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {team.country} · {team.region}
                </span>
                <span className="flex items-center gap-1 text-sky-100">{gameQ.data?.name}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onFollow}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${
                following
                  ? "bg-sky-500/25 text-sky-100"
                  : "bg-sky-500 text-ink hover:bg-sky-600"
              }`}
            >
              {following ? <Bell className="h-4 w-4 fill-sky-300" /> : <BellOff className="h-4 w-4" />}
              {following ? "Following" : "Follow"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-[11px] text-muted-foreground">Rank</p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold text-amber-300">
            <Trophy className="h-4 w-4" /> #{team.ranking}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-[11px] text-muted-foreground">W-L</p>
          <p className="mt-1 text-lg font-bold text-sky-400">
            {team.wins}-{team.losses}
          </p>
          <p className="text-[11px] text-muted-foreground">{winRate}% win rate</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-[11px] text-muted-foreground">Followers</p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold">
            <Users className="h-4 w-4" /> {formatFollowers(team.followers)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-[11px] text-muted-foreground">Active roster</p>
          <p className="mt-1 text-lg font-bold">{roster.length}</p>
        </div>
      </div>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Roster</h2>
        {rosterQ.isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-card" />
            ))}
          </div>
        ) : roster.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Roster not yet announced.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
                <UserAvatar
                  src={p.avatarUrl}
                  name={p.realName}
                  handle={p.handle}
                  seed={p.id}
                  decorative
                  className="h-12 w-12 shrink-0"
                  textClassName="text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.handle}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.realName}</p>
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
          <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            No scheduled matches.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-sm"
              >
                <Calendar className="h-4 w-4 text-sky-400" />
                <span className="font-medium">{m.round}</span>
                <span className="text-muted-foreground">Bo{m.bestOf}</span>
                <span className="ml-auto text-xs text-muted-foreground">
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
          <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
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
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-sm"
                >
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      won ? "bg-sky-500/10 text-sky-300" : "bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {won ? "W" : "L"}
                  </span>
                  <span className="font-medium">{m.round}</span>
                  <span className="ml-auto tabular-nums">
                    {ourScore} - {theirScore}
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
