"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Vod } from "@/lib/types";
import { relativeTime } from "./ngn";
import { Play } from "lucide-react";

interface Props {
  vods: Vod[];
}

export function WatchHistoryList({ vods }: Props) {
  if (vods.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-8 text-center text-sm text-neutral-400">
        Nothing watched yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/40">
      {vods.map((v) => (
        <li key={v.id}>
          <Link
            href={`/vod/${v.id}`}
            className="flex items-center gap-3 p-3 transition hover:bg-neutral-900"
          >
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-neutral-800">
              <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover" />
              <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                <Play className="size-6 text-white" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-100">{v.title}</p>
              <p className="text-xs text-neutral-500">
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
