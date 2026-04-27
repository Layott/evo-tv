"use client";

import { Radio, ShieldCheck, Volume2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { CoStreamTrack } from "@/lib/mock/co-streams";

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

export function NowPlayingBanner({ track }: { track: CoStreamTrack }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-gradient-to-r from-sky-500/10 via-neutral-900/40 to-neutral-900/40 p-3">
      <Avatar className="size-12 flex-shrink-0 ring-2 ring-sky-500/60">
        <AvatarImage src={track.avatarUrl} alt={track.displayName} />
        <AvatarFallback>{track.displayName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
            <Volume2 className="mr-1 inline size-3" />
            Now playing
          </span>
          {track.isOfficial ? (
            <Badge className="bg-sky-500 text-[9px] text-black">
              <ShieldCheck className="size-2.5" />
              Official
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px]">
              <Radio className="size-2.5" />
              Co-stream
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-neutral-50">
          {track.displayName}
        </p>
        <p className="line-clamp-1 text-[11px] text-neutral-400">{track.tagline}</p>
      </div>
      <div className="hidden flex-col items-end gap-0.5 text-right sm:flex">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          {LANG_LABELS[track.language] ?? track.language}
        </span>
        <span className="text-xs text-neutral-300">
          {track.viewerCount.toLocaleString()} listening
        </span>
      </div>
    </div>
  );
}
