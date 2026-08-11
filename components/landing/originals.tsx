import type { ShowArt } from "@/lib/epg/artwork";
import PosterCard from "./poster-card";

interface Props {
  shows: ShowArt[];
}

/** Alternating tilt so the posters read as pinned up, not as UI cards. */
const TILT = ["-1.6deg", "1.3deg", "-0.9deg", "1.8deg"];

/**
 * EVO's own shows.
 *
 * Every show with artwork appears here whether or not it is on the grid. An
 * earlier version hid anything that was scheduled, which emptied the rail the
 * moment the August originals were imported — deleting the best thing on the
 * page as a side effect of scheduling it. The card carries the air day instead.
 */
export default function Originals({ shows }: Props) {
  if (shows.length === 0) return null;

  return (
    <section className="relative mx-auto max-w-[92rem] px-5 py-20 sm:px-10 sm:py-28">
      <div className="reveal flex items-baseline gap-5">
        <h2 className="landing-display text-[clamp(2.4rem,7vw,5rem)]">
          EVO Originals
        </h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--paper-faint)]">
          Made here
        </span>
      </div>

      <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-14 lg:grid-cols-3 lg:gap-12">
        {shows.map((show, i) => (
          <PosterCard
            key={show.slug}
            show={show}
            tilt={TILT[i % TILT.length]!}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
