"use client";

import Image from "next/image";
import { Check, Eye, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Stream } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SelectableCardProps {
  stream: Stream;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SelectableCard({
  stream,
  selected,
  disabled,
  onToggle,
}: SelectableCardProps) {
  const inactive = disabled && !selected;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={inactive}
      aria-pressed={selected}
      className={cn(
        "group relative overflow-hidden rounded-xl border text-left transition-colors",
        selected
          ? "border-sky-500/60 bg-sky-500/5"
          : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700",
        inactive && "cursor-not-allowed opacity-50 hover:border-neutral-800",
      )}
    >
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={stream.thumbnailUrl}
          alt={stream.title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
          className={cn(
            "object-cover transition-transform duration-300",
            !inactive && "group-hover:scale-105",
          )}
        />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <span className="size-1 animate-pulse rounded-full bg-white" /> Live
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-neutral-100">
          <Eye className="size-3" />
          {formatViewers(stream.viewerCount)}
        </div>
        {/* Selection chip */}
        <div
          className={cn(
            "absolute left-2 bottom-2 flex size-7 items-center justify-center rounded-full border-2 backdrop-blur-sm transition-colors",
            selected
              ? "border-sky-400 bg-sky-500 text-black"
              : "border-neutral-700 bg-black/60 text-neutral-300 group-hover:border-sky-500/40",
          )}
        >
          {selected ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
        </div>
        {stream.isPremium ? (
          <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
            <Lock className="size-2.5" /> Premium
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-neutral-100">
          {stream.title}
        </h3>
        <p className="text-xs text-neutral-400">{stream.streamerName}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[9px] uppercase">
            {stream.language}
          </Badge>
          {stream.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" className="bg-neutral-800 text-[9px] text-neutral-300">
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </button>
  );
}
