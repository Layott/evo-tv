"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Clip } from "@/lib/types";
import { listTrendingClips } from "@/lib/client";
import { Badge } from "@/components/ui/badge";
import { Flame, Play, Heart } from "lucide-react";

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ClipsFeedPage() {
  const [clips, setClips] = React.useState<Clip[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listTrendingClips(24).then((c) => {
      if (!cancelled) setClips(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="size-6 text-amber-400" />
            Trending Clips
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bite-sized highlights from tonight's biggest matches.
          </p>
        </div>
        <Badge variant="outline" className="uppercase text-[10px]">
          {clips?.length ?? 0} clips
        </Badge>
      </header>

      {!clips ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[9/16] rounded-lg bg-card animate-pulse"
            />
          ))}
        </div>
      ) : clips.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No clips right now. Check back after tonight's matches.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {clips.map((c) => (
            <ClipCard key={c.id} clip={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClipCard({ clip }: { clip: Clip }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <Link
      href={`/clips/${clip.id}`}
      className="group relative overflow-hidden rounded-lg border border-border bg-card aspect-[9/16] block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Image
        src={clip.thumbnailUrl}
        alt={clip.title}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        sizes="(max-width:640px) 50vw, 20vw"
      />
      {/* Hover pulse - "preview frame" cosmetic */}
      {hovered && (
        <div className="absolute inset-0 ring-2 ring-sky-400/70 animate-pulse pointer-events-none" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-2">
        <p className="text-xs font-semibold text-white line-clamp-2">
          {clip.title}
        </p>
        <div className="mt-1 flex items-center justify-between text-[10px] text-foreground/80">
          <span>@{clip.creatorHandle}</span>
          <span>{relTime(clip.createdAt)}</span>
        </div>
      </div>
      <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
        <Play className="size-3" />
        {clip.viewCount.toLocaleString()}
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
        <Heart className="size-3" />
        {clip.likeCount.toLocaleString()}
      </div>
    </Link>
  );
}
