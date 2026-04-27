"use client";

import { Eye, Volume2, VolumeX, X } from "lucide-react";
import type { Stream } from "@/lib/types";
import { RICK_ROLL_YOUTUBE_ID } from "@/lib/mock/_media";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StreamTileProps {
  stream: Stream;
  isAudioActive: boolean;
  onActivateAudio: () => void;
  onRemove: () => void;
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function StreamTile({
  stream,
  isAudioActive,
  onActivateAudio,
  onRemove,
}: StreamTileProps) {
  const muteParam = isAudioActive ? 0 : 1;
  // Cache-bust the iframe key on mute change so YouTube actually mutes/unmutes.
  const iframeSrc = `https://www.youtube.com/embed/${RICK_ROLL_YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1&mute=${muteParam}`;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-black transition-colors",
        isAudioActive
          ? "border-sky-500/60 ring-1 ring-sky-500/40"
          : "border-neutral-800 hover:border-neutral-700",
      )}
    >
      <div className="relative aspect-video w-full">
        <iframe
          key={`${stream.id}_${muteParam}`}
          src={iframeSrc}
          title={stream.title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />

        {/* Top overlay — title + viewers */}
        <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-1 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <span className="size-1 animate-pulse rounded-full bg-white" /> Live
          </div>
          <div className="flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-neutral-100">
            <Eye className="size-3" />
            {formatViewers(stream.viewerCount)}
          </div>
        </div>

        {/* Bottom overlay — title + audio toggle + remove */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-xs font-semibold text-neutral-50">
              {stream.title}
            </p>
            <p className="line-clamp-1 text-[10px] text-neutral-400">
              {stream.streamerName}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant={isAudioActive ? "default" : "outline"}
              className={cn(
                "size-7",
                isAudioActive
                  ? "bg-sky-500 text-black hover:bg-sky-400"
                  : "border-neutral-700 bg-black/70 text-neutral-200 hover:border-sky-500/60",
              )}
              onClick={onActivateAudio}
              aria-pressed={isAudioActive}
              aria-label={isAudioActive ? "Audio active" : "Activate audio"}
              title={isAudioActive ? "Audio active" : "Make this the active audio"}
            >
              {isAudioActive ? (
                <Volume2 className="size-3.5" />
              ) : (
                <VolumeX className="size-3.5" />
              )}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="size-7 border-neutral-700 bg-black/70 text-neutral-200 hover:border-red-500/60 hover:text-red-300"
              onClick={onRemove}
              aria-label="Remove from grid"
              title="Remove from grid"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
