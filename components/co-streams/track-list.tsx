"use client";

import * as React from "react";
import { Eye, Radio, ShieldCheck, Volume2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { CoStreamTrack } from "@/lib/mock/co-streams";
import { cn } from "@/lib/utils";

const LANG_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
  pt: "Portuguese",
  ar: "Arabic",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  sw: "Swahili",
};

interface TrackListProps {
  tracks: CoStreamTrack[];
  selectedId: string | null;
  onSelect: (track: CoStreamTrack) => void;
}

export function TrackList({ tracks, selectedId, onSelect }: TrackListProps) {
  return (
    <ul role="radiogroup" className="space-y-2">
      {tracks.map((t) => {
        const isSelected = t.id === selectedId;
        return (
          <li key={t.id}>
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(t)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                isSelected
                  ? "border-sky-500/60 bg-sky-500/10"
                  : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700",
              )}
            >
              <span
                className={cn(
                  "relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected
                    ? "border-sky-400 bg-sky-500/20"
                    : "border-neutral-600 bg-neutral-950",
                )}
              >
                {isSelected ? (
                  <span className="size-2 rounded-full bg-sky-400" />
                ) : null}
              </span>
              <Avatar
                className={cn(
                  "size-10 flex-shrink-0",
                  t.isOfficial ? "ring-2 ring-sky-500/60" : "ring-1 ring-neutral-700",
                )}
              >
                <AvatarImage src={t.avatarUrl} alt={t.displayName} />
                <AvatarFallback className="text-[10px]">
                  {t.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-neutral-100">
                    {t.displayName}
                  </span>
                  {t.isOfficial ? (
                    <Badge className="bg-sky-500 text-[9px] text-black">
                      <ShieldCheck className="size-2.5" /> Official
                    </Badge>
                  ) : null}
                </div>
                <p className="line-clamp-1 text-[11px] text-neutral-400">{t.tagline}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                  <Badge variant="outline" className="text-[9px] uppercase">
                    {LANG_LABELS[t.language] ?? t.language}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" />
                    {t.viewerCount.toLocaleString()}
                  </span>
                  {!t.isOfficial ? (
                    <span className="flex items-center gap-1">
                      <Radio className="size-3" />
                      +{t.delaySeconds}s delay
                    </span>
                  ) : null}
                </div>
              </div>
              {isSelected ? (
                <div className="flex flex-col items-end gap-0.5 text-[10px] uppercase tracking-wider text-sky-300">
                  <Volume2 className="size-4" />
                  Tuned in
                </div>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
