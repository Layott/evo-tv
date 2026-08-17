"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getEventById, listMatchesForEvent, listTeams } from "@/lib/client";
import BracketView from "@/components/events/bracket-view";
import type { Team } from "@/lib/types";

export default function EventBracketPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const eventQ = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEventById(id),
  });
  const matchesQ = useQuery({
    queryKey: ["matches", id],
    queryFn: () => listMatchesForEvent(id),
  });
  const teamsQ = useQuery({
    queryKey: ["teams"],
    queryFn: () => listTeams(),
  });

  const event = eventQ.data;
  const matches = matchesQ.data ?? [];
  const teamMap = new Map<string, Team>((teamsQ.data ?? []).map((t) => [t.id, t]));

  if (!eventQ.isPending && !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Event not found</h1>
        <Link
          href="/events"
          className="mt-6 inline-flex rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-sky-400"
        >
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link
            href={event ? `/events/${event.id}` : "/events"}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to event
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {event?.title ?? "Bracket"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {event?.format ?? "Single elimination"}
          </p>
        </div>
      </div>

      {matchesQ.isPending || teamsQ.isPending ? (
        <div className="flex gap-6 overflow-x-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 w-64 shrink-0 rounded-xl bg-card" />
          ))}
        </div>
      ) : (
        <BracketView matches={matches} teams={teamMap} />
      )}
    </div>
  );
}
