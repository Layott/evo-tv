"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Vod } from "@/lib/types";

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function VodRelated({ vods }: { vods: Vod[] }) {
  if (!vods || vods.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">Related VODs</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {vods.map((v) => (
          <Link
            key={v.id}
            href={`/vod/${v.id}`}
            className="group rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition"
          >
            <div className="relative aspect-video bg-neutral-900">
              <Image
                src={v.thumbnailUrl}
                alt={v.title}
                fill
                className="object-cover group-hover:scale-[1.02] transition-transform"
                sizes="(max-width:640px) 100vw, 33vw"
              />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-white">
                {fmtDuration(v.durationSec)}
              </span>
              {v.isPremium && (
                <span className="absolute top-1.5 left-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  PREMIUM
                </span>
              )}
            </div>
            <div className="p-2.5">
              <h3 className="text-sm font-medium text-neutral-100 line-clamp-2">
                {v.title}
              </h3>
              <p className="mt-1 text-[11px] text-neutral-500">
                {v.viewCount.toLocaleString()} views · {relTime(v.publishedAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
