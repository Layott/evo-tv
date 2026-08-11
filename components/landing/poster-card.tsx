"use client";

import * as React from "react";
import Image from "next/image";
import type { ShowArt } from "@/lib/epg/artwork";

interface Props {
  show: ShowArt;
  tilt: string;
  /** Stagger index for the reveal. */
  index: number;
}

/**
 * A show poster that plays its trailer in place.
 *
 * Desktop plays on hover; touch has no hover, so a tap toggles it. The video is
 * `preload="none"`, so a visitor who never interacts downloads none of it —
 * these files are ~0.8 to 1.2 MB each.
 */
export default function PosterCard({ show, tilt, index }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);

  const start = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setPlaying(true);
    // play() rejects if the gesture is not trusted or the element is detached;
    // the still stays up in that case, which is the correct fallback.
    void el.play().catch(() => setPlaying(false));
  }, []);

  const stop = React.useCallback(() => {
    const el = videoRef.current;
    setPlaying(false);
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  const hasTrailer = Boolean(show.trailer);

  return (
    <article
      className="reveal group"
      style={{ animationDelay: `${index * 90}ms` }}
      onMouseEnter={hasTrailer ? start : undefined}
      onMouseLeave={hasTrailer ? stop : undefined}
    >
      <div
        className="poster-pin relative overflow-hidden"
        style={{
          transform: `rotate(${tilt})`,
          // A dropped shadow tinted with the artwork's own colour, so the
          // posters do not all sit under identical grey boxes.
          boxShadow: `0 26px 60px -28px ${show.accent}80, 0 8px 22px -14px rgba(0,0,0,0.85)`,
        }}
      >
        {/* 4:5, matching the delivered artwork exactly so nothing is cropped. */}
        <div className="relative aspect-[4/5] w-full">
          <Image
            src={show.poster}
            alt={`${show.title} poster`}
            fill
            // next.config sets images.unoptimized, so these are the WebP files
            // shipped in public/shows rather than anything resized per request.
            sizes="(min-width: 640px) 50vw, 100vw"
            placeholder="blur"
            blurDataURL={show.blurDataURL}
            className="object-cover"
          />

          {hasTrailer ? (
            <>
              <video
                ref={videoRef}
                src={show.trailer}
                muted
                loop
                playsInline
                preload="none"
                aria-hidden={!playing}
                className={[
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                  playing ? "opacity-100" : "opacity-0",
                ].join(" ")}
              />

              <button
                type="button"
                onClick={() => (playing ? stop() : start())}
                aria-label={
                  playing
                    ? `Stop the ${show.title} trailer`
                    : `Play the ${show.title} trailer`
                }
                className="absolute inset-0 flex items-end justify-start p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-inset"
              >
                <span
                  className={[
                    "landing-display px-3 py-1.5 text-[0.9rem] transition-all duration-300",
                    playing
                      ? "translate-y-1 opacity-0"
                      : "bg-[var(--ink)]/85 text-[var(--paper)] opacity-100 group-hover:bg-[var(--brand)] group-hover:text-[var(--ink)]",
                  ].join(" ")}
                >
                  Trailer
                </span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-7">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {show.brand ? (
            <p className="landing-display text-[0.95rem] text-[var(--paper-faint)]">
              {show.brand}
            </p>
          ) : null}
          {show.airs ? (
            <p className="landing-display text-[0.95rem] text-[var(--brand)]">
              {show.airs}
            </p>
          ) : null}
        </div>

        <h3
          className="landing-display mt-2 text-[clamp(1.7rem,3.6vw,2.5rem)]"
          style={{ color: show.accentOnDark }}
        >
          {show.title}
        </h3>
        <p className="mt-2 text-[0.98rem] text-[var(--paper-dim)]">
          {show.tagline ?? show.handle ?? ""}
        </p>
      </div>
    </article>
  );
}
