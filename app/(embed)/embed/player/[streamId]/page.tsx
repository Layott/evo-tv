"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { streams } from "@/lib/mock/streams";
import { vods } from "@/lib/mock/vods";
import { RICK_ROLL_YOUTUBE_ID } from "@/lib/mock/_media";

const SAMPLE_VOD_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export default function EmbedPlayerPage() {
  const params = useParams<{ streamId: string }>();
  const search = useSearchParams();
  const id = params?.streamId ?? "";
  const autoplay = search.get("autoplay") === "1";
  const muted = search.get("muted") === "1";

  const stream = streams.find((s) => s.id === id);
  const vod = !stream ? vods.find((v) => v.id === id) : null;

  if (!stream && !vod) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-neutral-400">
        <div className="text-center">
          <h1 className="text-base font-semibold text-neutral-200">Source not found</h1>
          <p className="mt-1 text-xs">This stream or VOD is unavailable.</p>
        </div>
      </div>
    );
  }

  if (stream) {
    const ytParams = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      mute: muted ? "1" : "0",
      controls: "1",
      modestbranding: "1",
      rel: "0",
    });
    const src = `https://www.youtube.com/embed/${RICK_ROLL_YOUTUBE_ID}?${ytParams.toString()}`;
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <iframe
          src={src}
          title={stream.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
        <BrandTag label={stream.title} live />
      </div>
    );
  }

  if (vod) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <video
          src={SAMPLE_VOD_VIDEO}
          poster={vod.thumbnailUrl}
          controls
          autoPlay={autoplay}
          muted={muted}
          playsInline
          className="h-full w-full object-contain"
        />
        <BrandTag label={vod.title} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-neutral-500">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function BrandTag({ label, live }: { label: string; live?: boolean }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-neutral-100 backdrop-blur">
      <span className="font-bold text-sky-400">EVO TV</span>
      {live ? (
        <span className="flex items-center gap-1 text-red-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          LIVE
        </span>
      ) : null}
      <span className="hidden max-w-[280px] truncate text-neutral-300 sm:inline">· {label}</span>
    </div>
  );
}
