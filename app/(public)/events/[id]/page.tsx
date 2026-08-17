"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, ListTree, Play } from "@/components/icons";
import { toast } from "sonner";
import { BackButton } from "@/components/shell/back-button";
import {
  getEventById,
  getGameById,
  getTeamById,
  listMatchesForEvent,
  listPlayers,
  listLiveStreams,
} from "@/lib/client";
import EventHero from "@/components/events/event-hero";
import CountdownTimer from "@/components/events/countdown-timer";
import TeamRoster from "@/components/events/team-roster";
import type { Team } from "@/lib/types";

const REMINDERS_KEY = "evotv_reminders_v1";

function readReminders(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(REMINDERS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeReminders(s: Set<string>) {
  try {
    window.localStorage.setItem(REMINDERS_KEY, JSON.stringify([...s]));
  } catch {
    /* noop */
  }
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const eventQ = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEventById(id),
  });
  const event = eventQ.data;

  const gameQ = useQuery({
    queryKey: ["game", event?.gameId],
    queryFn: () => getGameById(event!.gameId),
    enabled: !!event,
  });

  const teamsQ = useQuery({
    queryKey: ["event-teams", id, event?.teamIds.join(",")],
    queryFn: async () => {
      if (!event) return [] as Team[];
      const arr = await Promise.all(event.teamIds.map((tid) => getTeamById(tid)));
      return arr.filter((t): t is Team => t !== null);
    },
    enabled: !!event,
  });

  const matchesQ = useQuery({
    queryKey: ["matches", id],
    queryFn: () => listMatchesForEvent(id),
  });

  const liveStreamQ = useQuery({
    queryKey: ["streams", "event", id],
    queryFn: async () => {
      const all = await listLiveStreams();
      return all.find((s) => s.eventId === id) ?? null;
    },
    enabled: event?.status === "live",
  });

  const allPlayersQ = useQuery({
    queryKey: ["players", "all"],
    queryFn: () => listPlayers(),
  });

  const [reminded, setReminded] = React.useState(false);
  React.useEffect(() => {
    if (!id) return;
    setReminded(readReminders().has(id));
  }, [id]);

  const toggleRemind = () => {
    const s = readReminders();
    if (s.has(id)) {
      s.delete(id);
      writeReminders(s);
      setReminded(false);
      toast.success("Reminder removed");
    } else {
      s.add(id);
      writeReminders(s);
      setReminded(true);
      toast.success("You'll be reminded when this event starts");
    }
  };

  if (!eventQ.isPending && !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The event you're looking for doesn't exist.
        </p>
        <Link
          href="/events"
          className="mt-6 inline-flex rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-sky-400"
        >
          Back to events
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="h-72 rounded-xl bg-card" />
      </div>
    );
  }

  const teams = teamsQ.data ?? [];
  const allPlayers = allPlayersQ.data ?? [];
  const matchesByState = matchesQ.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <BackButton fallbackHref="/events" />
      </div>
      <EventHero event={event} game={gameQ.data} />

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground/80">{event.description}</p>
          <div className="flex flex-wrap gap-2">
            {event.status === "live" && liveStreamQ.data && (
              <Link
                href={`/stream/${liveStreamQ.data.id}`}
                className="inline-flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
              >
                <Play className="h-4 w-4 fill-white" /> Watch live
              </Link>
            )}
            <button
              type="button"
              onClick={toggleRemind}
              disabled={event.status === "completed"}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                reminded
                  ? "bg-sky-500/25 text-sky-100"
                  : "border-border bg-card/60 text-foreground hover:bg-card"
              }`}
            >
              {reminded ? <Bell className="h-4 w-4 fill-sky-300" /> : <BellOff className="h-4 w-4" />}
              {reminded ? "Reminder on" : "Remind me"}
            </button>
            <Link
              href={`/events/${event.id}/bracket`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-card"
            >
              <ListTree className="h-4 w-4" /> View bracket
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/60 p-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Format</dt>
              <dd className="mt-0.5 font-medium">{event.format}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Region</dt>
              <dd className="mt-0.5 font-medium">{event.region}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Teams</dt>
              <dd className="mt-0.5 font-medium">{event.teamIds.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Matches</dt>
              <dd className="mt-0.5 font-medium">{matchesByState.length}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card/60 p-4 lg:w-auto lg:min-w-[280px]">
          {event.status === "scheduled" && (
            <CountdownTimer target={event.startsAt} label="Starts in" />
          )}
          {event.status === "live" && (
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Live now
              </span>
              <p className="text-sm text-foreground/80">Event in progress.</p>
            </div>
          )}
          {event.status === "completed" && (
            <div className="flex flex-col gap-2">
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-foreground/80">
                Concluded
              </span>
              <p className="text-sm text-muted-foreground">
                This event ended {new Date(event.endsAt).toLocaleDateString()}.
              </p>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Participating teams</h2>
        {teamsQ.isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-card" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Teams TBA
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <TeamRoster
                key={t.id}
                team={t}
                players={allPlayers.filter((p) => p.teamId === t.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
