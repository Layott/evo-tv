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
 * The placeholder is a deterministic flat fill seeded from the title, so the same
 * item always gets the same colour and a grid of them does not look like a
 * loading failure.
 *
 * It used to be `hue = hash % 360` on a two-stop gradient, which meant a shelf of
 * artwork-less shows came out magenta, lime and orange next to each other. The
 * hue is bounded to the arc between the two wordmark colours now, so the variety
 * is still per-item but every tile stays inside the brand.
 */

/** Mint #46E3CE sits at ~172deg, blue #42ACE8 at ~201deg. */
const BRAND_HUE_START = 172;
const BRAND_HUE_SPAN = 34;

/**
 * The stock v0 placeholder assets, which are a #EAEAEA rectangle with a grey
 * camera glyph. Treating them as "no artwork" rather than as a picture matters
 * because they are not only a default in the admin forms: rows already in the
 * database carry `/placeholder.svg` in their image column, so a shop product or
 * a show with no photo painted a near-white block into a dark page. Catching the
 * path here fixes every existing row without a migration.
 */
function isStockPlaceholder(src: string): boolean {
  const path = src.split("?")[0]!.toLowerCase();
  return (
    path.endsWith("/placeholder.svg") ||
    path.endsWith("/placeholder.jpg") ||
    path.endsWith("/placeholder-user.jpg") ||
    path.endsWith("/placeholder-logo.svg") ||
    path.endsWith("/placeholder-logo.png")
  );
}

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

  const usable =
    typeof src === "string" &&
    src.trim() !== "" &&
    !isStockPlaceholder(src) &&
    !failed;

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

  const hue = BRAND_HUE_START + (hashString(seed ?? alt) % BRAND_HUE_SPAN);
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
      // A dark tile either way round: it stands in for artwork, and artwork does
      // not follow the theme any more than a video letterbox does.
      style={{ backgroundColor: `hsl(${hue} 32% 15%)` }}
    >
      <span className="select-none text-lg font-bold tracking-tight text-white/25">
        {initials || "EVO"}
      </span>
    </div>
  );
}
