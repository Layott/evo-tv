"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Team, Player } from "@/lib/types";
import { Users } from "lucide-react";

interface Props {
  teams: Team[];
  players: Player[];
}

export function FollowingGrid({ teams, players }: Props) {
  const empty = teams.length === 0 && players.length === 0;
  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-8 text-center">
        <Users className="mx-auto size-10 text-neutral-600" />
        <p className="mt-3 text-sm font-medium text-neutral-300">
          You&apos;re not following anyone yet.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Find teams and players in Discover.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {teams.length ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-neutral-300">Teams</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/team/${t.slug}`}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 transition hover:border-sky-500/40"
              >
                <Image
                  src={t.logoUrl}
                  alt={t.name}
                  width={48}
                  height={48}
                  className="size-12 rounded-lg bg-neutral-800 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-neutral-500">{t.tag}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {players.length ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-neutral-300">Players</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3"
              >
                <Image
                  src={p.avatarUrl}
                  alt={p.handle}
                  width={48}
                  height={48}
                  className="size-12 rounded-full bg-neutral-800 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.handle}</p>
                  <p className="text-xs text-neutral-500">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
