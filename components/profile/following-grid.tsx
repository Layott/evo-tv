"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Team, Player } from "@/lib/types";
import { Users } from "@/components/icons";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MediaImage } from "@/components/ui/media-image";

interface Props {
  teams: Team[];
  players: Player[];
}

export function FollowingGrid({ teams, players }: Props) {
  const empty = teams.length === 0 && players.length === 0;
  if (empty) {
    return (
      <div className="rounded-xl bg-card/50 bg-card/30 p-8 text-center">
        <Users className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground/80">
          You&apos;re not following anyone yet.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Find teams and players in Discover.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {teams.length ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground/80">Teams</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/team/${t.slug}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition hover:border-sky-500/40"
              >
                <MediaImage src={t.logoUrl} alt={t.name} className="size-12 rounded-lg bg-muted object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.tag}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {players.length ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground/80">Players</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
              >
                <UserAvatar
                  src={p.avatarUrl}
                  handle={p.handle}
                  seed={p.id}
                  decorative
                  className="size-12 shrink-0"
                  textClassName="text-sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.handle}</p>
                  <p className="text-xs text-muted-foreground">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
