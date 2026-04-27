"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  screenshots: string[];
  /** Visual frame around the screenshots. */
  frame?: "phone" | "tv" | "desktop" | "tablet";
  className?: string;
}

const FRAME_RATIO: Record<NonNullable<Props["frame"]>, string> = {
  phone: "aspect-[9/16]",
  tv: "aspect-video",
  desktop: "aspect-video",
  tablet: "aspect-[4/3]",
};

const FRAME_RADIUS: Record<NonNullable<Props["frame"]>, string> = {
  phone: "rounded-[36px]",
  tv: "rounded-2xl",
  desktop: "rounded-xl",
  tablet: "rounded-3xl",
};

const FRAME_PAD: Record<NonNullable<Props["frame"]>, string> = {
  phone: "p-[10px]",
  tv: "p-[6px]",
  desktop: "p-[6px]",
  tablet: "p-[10px]",
};

const FRAME_BG: Record<NonNullable<Props["frame"]>, string> = {
  phone: "bg-neutral-950 ring-1 ring-neutral-800",
  tv: "bg-neutral-950 ring-1 ring-neutral-800",
  desktop: "bg-neutral-950 ring-1 ring-neutral-800",
  tablet: "bg-neutral-950 ring-1 ring-neutral-800",
};

export function ScreenshotCarousel({
  screenshots,
  frame = "phone",
  className,
}: Props) {
  const [idx, setIdx] = React.useState(0);
  const safeIdx = ((idx % screenshots.length) + screenshots.length) % screenshots.length;

  // Auto-advance every 4s, pause on hover.
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const i = setInterval(() => setIdx((v) => v + 1), 4000);
    return () => clearInterval(i);
  }, [paused]);

  if (screenshots.length === 0) return null;

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIdx((v) => v - 1)}
          aria-label="Previous screenshot"
          className="hidden sm:inline-flex"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div
          className={`relative w-full max-w-[420px] overflow-hidden ${FRAME_RADIUS[frame]} ${FRAME_BG[frame]} ${FRAME_PAD[frame]}`}
        >
          <div
            className={`relative w-full overflow-hidden ${FRAME_RATIO[frame]} ${frame === "phone" ? "rounded-[28px]" : "rounded-lg"} bg-neutral-900`}
          >
            <Image
              key={safeIdx}
              src={screenshots[safeIdx]!}
              alt={`Screenshot ${safeIdx + 1}`}
              fill
              sizes="(max-width: 768px) 90vw, 420px"
              className="object-cover transition-opacity"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIdx((v) => v + 1)}
          aria-label="Next screenshot"
          className="hidden sm:inline-flex"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {screenshots.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Go to screenshot ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === safeIdx ? "w-6 bg-sky-500" : "w-1.5 bg-neutral-700 hover:bg-neutral-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
