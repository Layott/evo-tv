"use client";

import * as React from "react";
import { Clock, Users, Star } from "lucide-react";

interface Props {
  followingCount: number;
  watchHours: string;
  subSince: string | null;
}

export function StatsRow({ followingCount, watchHours, subSince }: Props) {
  const items: Array<{ label: string; value: string; icon: React.ReactNode }> = [
    {
      label: "Following",
      value: String(followingCount),
      icon: <Users className="size-4 text-sky-400" />,
    },
    {
      label: "Watch time",
      value: watchHours,
      icon: <Clock className="size-4 text-sky-400" />,
    },
    {
      label: "Subscribed",
      value: subSince ?? "Not active",
      icon: <Star className="size-4 text-amber-400" />,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-border bg-card/60 p-4"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            {it.icon}
            {it.label}
          </div>
          <div className="mt-2 text-xl font-semibold text-foreground">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
