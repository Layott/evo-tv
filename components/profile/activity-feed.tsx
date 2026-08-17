"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Play, ShoppingBag } from "lucide-react";

import { listOrdersForUser } from "@/lib/client";

/**
 * What this account has actually done.
 *
 * The list used to be four hardcoded rows shown to everyone: "Watched EVO
 * Championship Week 4 Recap", "Liked clip: Insane 1v4 clutch by viper",
 * "Joined chat on stream_lagos_final", "Ordered Team Alpha Jersey". A brand new
 * account with nothing followed and no subscription still saw all four, dated
 * to hours and days ago. It read as a record of things the person had done, and
 * none of it had happened.
 *
 * It now merges the two activity sources that exist and are per-user: episodes
 * in progress, and orders. Likes and chat are deliberately absent rather than
 * approximated, because there is no per-user feed behind either yet.
 *
 * With empty content tables a new account correctly shows nothing, which is the
 * honest answer and the one a real first-time user should get.
 */

interface Entry {
  key: string;
  icon: React.ReactNode;
  label: string;
  href?: string;
  at: string;
}

interface ContinueWatchingItem {
  episode: { seasonNumber: number; episodeNumber: number; title: string };
  show: { slug: string; title: string };
  updatedAt: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityFeed() {
  const watching = useQuery({
    queryKey: ["activity", "continue-watching"],
    queryFn: async (): Promise<ContinueWatchingItem[]> => {
      const res = await fetch("/api/originals/continue-watching?limit=6", {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { items?: ContinueWatchingItem[] };
      return data.items ?? [];
    },
  });

  const orders = useQuery({
    queryKey: ["activity", "orders"],
    queryFn: () => listOrdersForUser(),
  });

  const entries: Entry[] = React.useMemo(() => {
    const out: Entry[] = [];

    for (const w of watching.data ?? []) {
      out.push({
        key: `w_${w.show.slug}_${w.episode.seasonNumber}_${w.episode.episodeNumber}`,
        icon: <Play className="size-4 text-sky-400" />,
        label: `Watched ${w.show.title}: ${w.episode.title}`,
        href: `/show/${w.show.slug}/${w.episode.seasonNumber}/${w.episode.episodeNumber}`,
        at: w.updatedAt,
      });
    }

    for (const o of orders.data ?? []) {
      const count = o.items?.length ?? 0;
      out.push({
        key: `o_${o.id}`,
        icon: <ShoppingBag className="size-4 text-amber-400" />,
        label:
          count === 1
            ? `Ordered ${o.items[0]?.productName ?? "an item"}`
            : `Ordered ${count} items`,
        href: `/order/${o.id}`,
        at: o.createdAt,
      });
    }

    return out
      .filter((e) => e.at)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6);
  }, [watching.data, orders.data]);

  const loading = watching.isPending || orders.isPending;

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-card" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-xl bg-card/40 px-4 py-6 text-sm text-muted-foreground">
        Nothing here yet. What you watch and order will show up in this list.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl bg-card/40">
      {entries.map((e) => {
        const row = (
          <div className="flex items-center gap-3 p-3">
            <div className="rounded-full bg-muted p-2">{e.icon}</div>
            <p className="flex-1 truncate text-sm text-foreground">{e.label}</p>
            <p className="shrink-0 text-xs text-muted-foreground">{relTime(e.at)}</p>
          </div>
        );
        return (
          <li key={e.key}>
            {e.href ? (
              <Link href={e.href} className="block hover:bg-accent/60">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
