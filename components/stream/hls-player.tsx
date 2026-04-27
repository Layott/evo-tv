"use client";

import * as React from "react";
import Hls, { type Level } from "hls.js";

interface Props {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  onReady?: (levels: Level[]) => void;
}

export function HlsPlayer({
  src,
  poster,
  autoPlay = true,
  muted = true,
  className,
  onReady,
}: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setErr(null);

    const isNative = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    const isHls = src.endsWith(".m3u8");

    if (isHls && !isNative && Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 3,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onReady?.(hls.levels);
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setErr(data.details || "HLS fatal error");
        }
      });
      return () => {
        hls.destroy();
      };
    }

    video.src = src;
    if (autoPlay) video.play().catch(() => {});
    const onErr = () => setErr("Stream unavailable");
    video.addEventListener("error", onErr);
    return () => {
      video.removeEventListener("error", onErr);
    };
  }, [src, autoPlay, onReady]);

  return (
    <div className={`relative bg-black ${className ?? ""}`}>
      <video
        ref={videoRef}
        poster={poster}
        muted={muted}
        playsInline
        controls
        className="h-full w-full"
      />
      {err && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-neutral-300">
          {err}
        </div>
      )}
    </div>
  );
}
