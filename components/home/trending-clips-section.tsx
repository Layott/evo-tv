"use client";

import Link from "next/link";
import { MediaImage } from "@/components/ui/media-image";
import { Play, Eye } from "@/components/icons";
import type { Clip } from "@/lib/types";

interface TrendingClipsProps {
  clips: Clip[];
  loading: boolean;
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function SkeletonCard() {
  return <div className="aspect-[9/16] w-40 shrink-0 rounded-xl bg-card" />;
}

export function TrendingClips({ clips, loading }: TrendingClipsProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Trending Clips</h2>
        <Link
          href="/discover"
          className="text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          See all
        </Link>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : clips.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No clips are trending yet.
        </div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {clips.map((c) => (
            <Link
              key={c.id}
              href={`/vod/${c.vodId ?? c.id}`}
              className="group relative w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
            >
              <div className="relative aspect-[9/16] overflow-hidden">
                <MediaImage
                    src={c.thumbnailUrl}
                    alt={c.title}
                    seed={c.id}
                    className="h-full w-full object-cover"
                  />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/90">
                    <Play className="ml-0.5 h-5 w-5 fill-ink text-ink" />
                  </div>
                </div>
                <div className="absolute inset-x-2 bottom-2 space-y-1">
                  <p className="line-clamp-2 text-xs font-semibold text-white">
                    {c.title}
                  </p>
                  {typeof c.viewCount === "number" ? (
                    <div className="flex items-center gap-1 text-[10px] text-foreground/80">
                      <Eye className="h-3 w-3" /> {formatViewers(c.viewCount)}
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default TrendingClips;
