import Link from "next/link";

import type { ScheduleEntry } from "@/lib/epg/grid";
import HeroVideo from "./hero-video";
import SiteHeader from "./site-header";
import TvMark from "./tv-mark";

interface Props {
  onAir: ScheduleEntry | null;
}

/**
 * The opening screen: the channel, playing, behind the pitch.
 *
 * A television station should open by showing television, and the reel already
 * says what the channel is in a way a paragraph cannot. The type sits in the
 * lower third rather than dead centre, for two reasons: the reel carries its
 * own titles and its endcard across the middle of the frame, and the lower
 * third is where a broadcast puts its own captions anyway.
 *
 * The line under the buttons is the real schedule, read from the same guide as
 * the rest of the page. It is there instead of the star rating the reference
 * design carries, because EVO TV has no ratings and inventing some would be a
 * lie on the first screen of the site. What is on right now is better proof
 * that the channel is alive than a number would be.
 */
export default function VideoOpening({ onAir }: Props) {
  return (
    <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
      <HeroVideo />

      <SiteHeader />

      {/*
        The type block is deliberately small for a hero. It is furniture over a
        picture, not the picture itself: at full display size it covered most of
        the frame and the reel might as well not have been playing.
      */}
      <div className="relative z-10 flex flex-1 items-end justify-center px-5 pb-12 sm:px-10 sm:pb-16">
        <div className="w-full max-w-2xl text-center">
          <h1 className="wipe landing-display mx-auto max-w-[24ch] text-[clamp(1.85rem,4.4vw,3.4rem)]">
            Africa&apos;s home for{" "}
            <span className="text-[var(--brand)]">esports</span>, anime and
            lifestyle.
          </h1>

          <div
            className="reveal mt-5 flex items-center justify-center gap-2.5"
            style={{ animationDelay: "220ms" }}
          >
            <TvMark className="h-7 w-[2.1rem] shrink-0" />
            <p className="landing-display text-[0.98rem] text-[var(--brand)] sm:text-[1.1rem]">
              EVO TV is coming soon to UHF.
            </p>
          </div>

          <div
            className="reveal mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row sm:gap-3"
            style={{ animationDelay: "320ms" }}
          >
            {/* min-h-12 rather than padding alone: the display face has a 0.92
                line height, so `py-3` measured 39px on a phone, under the 44px
                a thumb needs. */}
            <Link
              href="/signup"
              className="landing-display flex min-h-12 w-full items-center justify-center bg-[var(--brand)] px-6 text-[1rem] text-[var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
            >
              Start watching
            </Link>
            <a
              href="#week"
              className="landing-display flex min-h-12 w-full items-center justify-center bg-[var(--paper)]/10 px-6 text-[1rem] text-[var(--paper)] backdrop-blur-sm transition-colors hover:bg-[var(--paper)]/20 sm:w-auto"
            >
              See what&apos;s on
            </a>
          </div>

          {onAir ? (
            <p
              className="reveal mt-5 text-[0.85rem] text-[var(--paper-dim)]"
              style={{ animationDelay: "420ms" }}
            >
              <span className="text-[var(--brand)]">On now</span>
              {" · "}
              <span className="landing-display text-[var(--paper)]">
                {onAir.title}
              </span>
              {" · "}
              <span className="font-mono tabular-nums">
                {onAir.startLabel}-{onAir.endLabel}
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
