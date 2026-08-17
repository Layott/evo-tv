"use client";

import * as React from "react";
import { MediaImage } from "@/components/ui/media-image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { Play, Eye } from "@/components/icons";
import type { Stream } from "@/lib/types";

interface HeroCarouselProps {
  streams: Stream[];
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function HeroCarousel({ streams }: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => {
      emblaApi.scrollNext();
    }, 6000);
    return () => clearInterval(id);
  }, [emblaApi]);

  if (streams.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card/60 text-sm text-muted-foreground sm:h-64">
        No featured streams right now.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl" ref={emblaRef}>
        <div className="flex">
          {streams.map((s) => (
            <Link
              key={s.id}
              href={`/stream/${s.id}`}
              className="relative min-w-0 flex-[0_0_100%]"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
                <MediaImage
                    src={s.thumbnailUrl}
                    alt={s.title}
                    seed={s.id}
                    className="h-full w-full object-cover"
                  />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 sm:p-6">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      Live
                    </span>
                    <span className="flex items-center gap-1 text-xs text-paper/80">
                      <Eye className="h-3 w-3" /> {formatViewers(s.viewerCount)}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold leading-tight text-white sm:text-2xl">
                    {s.title}
                  </h2>
                  <p className="max-w-2xl text-xs text-paper/80 sm:text-sm">
                    {s.streamerName}
                  </p>
                  <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-ink">
                    <Play className="h-3.5 w-3.5 fill-ink" /> Watch now
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 flex gap-1.5">
        {streams.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`pointer-events-auto h-1.5 rounded-full transition-all ${
              i === selectedIndex ? "w-6 bg-sky-400" : "w-1.5 bg-muted-foreground/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroCarousel;
