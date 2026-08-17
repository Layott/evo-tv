"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Vod } from "@/lib/types";
import { relativeTime } from "./ngn";
import { Play } from "@/components/icons";

interface Props {
  vods: Vod[];
}

export function WatchHistoryList({ vods }: Props) {
  if (vods.length === 0) {
    return (
      <div className="rounded-xl bg-card/50 bg-card/30 p-8 text-center text-sm text-muted-foreground">
        Nothing watched yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card/40">
      {vods.map((v) => (
        <li key={v.id}>
          <Link
            href={`/vod/${v.id}`}
            className="flex items-center gap-3 p-3 transition hover:bg-accent"
          >
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover" />
              <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                <Play className="size-6 text-white" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{v.title}</p>
              <p className="text-xs text-muted-foreground">
                Viewed {relativeTime(v.publishedAt)} &middot;{" "}
                {Math.floor(v.durationSec / 60)} min
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
