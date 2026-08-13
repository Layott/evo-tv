"use client";

import * as React from "react";

/**
 * The video behind the opening screen.
 *
 * Written for a viewer on a phone in Lagos on a metered connection, not for the
 * machine it was built on. Three rules follow from that:
 *
 * 1. The poster is the page. It is a 59 KB WebP painted as a background, so the
 *    opening is complete and readable before a single byte of video is asked
 *    for. Nothing below waits on the video, and if the video never arrives
 *    nobody can tell something is missing.
 * 2. The video is optional. Data saver on, a 2G or 3G connection, or a stated
 *    preference for less motion, and it is never requested at all.
 * 3. It loads last. The request is deferred to idle so it cannot compete with
 *    the fonts, the CSS or the schedule query that make the page usable.
 *
 * Only h264 is shipped. VP9 was 9% smaller at 720p and larger at 480p, and it
 * is software-decoded on the cheap Android hardware most of the audience is
 * holding, which costs battery for nothing.
 */

/** Widest viewport each rendition is meant to cover, smallest first. */
const RENDITIONS = [
  { upTo: 640, src: "/hero/evotv-hero-360.mp4" },
  { upTo: 1024, src: "/hero/evotv-hero-480.mp4" },
  { upTo: Infinity, src: "/hero/evotv-hero-720.mp4" },
];

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/** null means "this viewer should not be sent a video at all". */
function chooseSource(): string | null {
  if (typeof window === "undefined") return null;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  if (connection?.saveData) return null;
  if (
    connection?.effectiveType &&
    ["slow-2g", "2g", "3g"].includes(connection.effectiveType)
  ) {
    return null;
  }

  const width = window.innerWidth;
  return (RENDITIONS.find((r) => width <= r.upTo) ?? RENDITIONS[2]).src;
}

export default function HeroVideo() {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [showing, setShowing] = React.useState(false);

  React.useEffect(() => {
    const source = chooseSource();
    if (!source) return;

    const load = () => {
      const el = ref.current;
      if (!el) return;
      el.src = source;
      el.load();
      // Autoplay can still be refused. The poster is already correct, so a
      // refusal needs no handling beyond not throwing.
      void el.play().catch(() => {});
    };

    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      const handle = idle(load, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(load, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      aria-hidden
      className="hero-stage absolute inset-0 overflow-hidden bg-[var(--ink)]"
    >
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        tabIndex={-1}
        onCanPlay={() => setShowing(true)}
        className="h-full w-full object-cover transition-opacity duration-700"
        style={{ opacity: showing ? 1 : 0 }}
      />
      {/*
        Two scrims, doing different jobs. The vertical one buys legibility for
        the header at the top and the headline at the foot while leaving the
        middle of the frame clear, which is where the advert's own titles and
        endcard live. The flat one takes the whole picture down far enough that
        white type holds over the brightest gameplay frames.
      */}
      <div className="pointer-events-none absolute inset-0 bg-[var(--ink)]/30" />
      <div className="pointer-events-none absolute inset-0 hero-scrim" />
    </div>
  );
}
