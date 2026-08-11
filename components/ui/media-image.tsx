"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A thumbnail that degrades to a branded placeholder instead of a broken image.
 *
 * Real content routinely arrives without artwork: an admin can create a stream,
 * take it live and never set a thumbnail, and every `<img src="">` on the page
 * then renders the browser's broken-image glyph. That was invisible while the
 * mock data shipped a picture for everything.
 *
 * The placeholder is a deterministic gradient seeded from the title, so the same
 * item always gets the same colours and a grid of them does not look like a
 * loading failure.
 */

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function MediaImage({
  src,
  alt,
  className,
  seed,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  /** Defaults to `alt`. Pass an id for a stable colour across title edits. */
  seed?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  // A new src deserves another attempt.
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const usable = typeof src === "string" && src.trim() !== "" && !failed;

  if (usable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- next.config sets
      // images.unoptimized, so next/image would add cost without benefit here.
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  const hue = hashString(seed ?? alt) % 360;
  const initials = alt
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "flex items-center justify-center bg-[var(--muted)]",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 45% 18%), hsl(${(hue + 40) % 360} 40% 10%))`,
      }}
    >
      <span className="select-none text-lg font-bold tracking-tight text-white/25">
        {initials || "EVO"}
      </span>
    </div>
  );
}
