"use client";

import Image from "next/image";
import Link from "next/link";
import { Coins, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Tip } from "@/lib/mock/tips";
import { relativeTime } from "@/components/profile/ngn";

interface TipListProps {
  tips: Tip[];
  perspective: "sent" | "received";
  emptyMessage?: string;
}

export function TipList({ tips, perspective, emptyMessage }: TipListProps) {
  if (tips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
        <MessageSquare className="mx-auto size-10 text-neutral-600" />
        <p className="mt-3 text-sm font-semibold text-neutral-200">
          {emptyMessage ?? (perspective === "sent" ? "You haven't tipped anyone yet." : "No tips received yet.")}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {perspective === "sent" ? "Tap a streamer's tip button while watching live to cheer them on." : "Tips from your viewers will show up here in real time."}
        </p>
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
      {tips.map((t) => {
        const personHandle = perspective === "sent" ? t.toStreamerHandle : t.fromHandle;
        const personName = perspective === "sent" ? t.toStreamerName : t.fromHandle.replace(/_/g, " ");
        const personAvatar = perspective === "sent" ? t.toStreamerAvatarUrl : t.fromAvatarUrl;
        return (
          <li
            key={t.id}
            className="flex items-start gap-3 border-b border-neutral-800/50 p-4 last:border-0 hover:bg-neutral-900/60"
          >
            <Avatar className="size-10 shrink-0 ring-1 ring-neutral-700">
              <AvatarImage src={personAvatar} alt={personName} />
              <AvatarFallback>{personName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="truncate text-sm font-semibold text-neutral-100">
                  {perspective === "sent" ? "Tip to " : ""}
                  {personName}
                </p>
                <span className="text-[11px] text-neutral-500">@{personHandle}</span>
                <span className="ml-auto text-[11px] text-neutral-500">{relativeTime(t.atIso)}</span>
              </div>
              {t.message ? (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-300">&ldquo;{t.message}&rdquo;</p>
              ) : (
                <p className="mt-1 text-xs italic text-neutral-500">no message</p>
              )}
              {t.streamId ? (
                <p className="mt-1 text-[11px] text-neutral-500">
                  on{" "}
                  <Link href={`/stream/${t.streamId}`} className="text-sky-400 hover:underline">
                    {t.streamTitle ?? t.streamId}
                  </Link>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <div className="flex items-center gap-1 text-amber-300">
                <Coins className="size-3.5" />
                <span className="text-sm font-bold tabular-nums">{t.amountCoins.toLocaleString()}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">EVO Coins</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
