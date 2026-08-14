"use client";

import * as React from "react";
import { VideoPlayer } from "@/components/stream/video-player";
import type { Vod } from "@/lib/types";

interface VodPlayerProps {
  vod: Vod;
  onTimeUpdate?: (sec: number) => void;
  onReady?: (video: HTMLVideoElement) => void;
  seekRef?: React.MutableRefObject<((sec: number) => void) | null>;
}

export function VodPlayer({ vod, onTimeUpdate, onReady, seekRef }: VodPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const handleReady = (video: HTMLVideoElement) => {
    videoRef.current = video;
    if (seekRef) {
      seekRef.current = (sec: number) => {
        if (videoRef.current) videoRef.current.currentTime = sec;
      };
    }
    onReady?.(video);
  };

  return (
    <VideoPlayer
      src={vod.mp4Url}
      poster={vod.thumbnailUrl}
      chapters={vod.chapters}
      onTimeUpdate={onTimeUpdate}
      onReady={handleReady}
      mediaId={vod.id}
    />
  );
}
