import Image from "next/image";
import type { ShowArt } from "@/lib/epg/artwork";

interface Props {
  shows: ShowArt[];
}

/** Alternating tilt so the posters read as pinned up, not as UI cards. */
const TILT = ["-1.6deg", "1.3deg", "-0.9deg", "1.8deg"];

/**
 * The shows that have finished artwork.
 *
 * No times attached. These titles are not on the April rotation, and giving them
 * an invented airtime so they could sit in the week grid would be the same
 * fabrication this page exists to avoid. When one is scheduled it picks up its
 * slot via `gridTitles` in the artwork registry and drops out of this rail.
 */
export default function Originals({ shows }: Props) {
  if (shows.length === 0) return null;

  return (
    <section className="relative mx-auto max-w-[92rem] px-5 py-20 sm:px-10 sm:py-28">
      <div className="flex items-baseline gap-5">
        <h2 className="landing-display text-[clamp(2.4rem,7vw,5rem)]">
          EVO Originals
        </h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--paper-faint)]">
          Made here
        </span>
      </div>

      <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-14 lg:gap-20">
        {shows.map((show, i) => (
          <PosterCard key={show.slug} show={show} tilt={TILT[i % TILT.length]!} />
        ))}
      </div>
    </section>
  );
}

function PosterCard({ show, tilt }: { show: ShowArt; tilt: string }) {
  return (
    <article className="group">
      <div
        className="poster-pin relative overflow-hidden"
        style={{
          transform: `rotate(${tilt})`,
          // A dropped shadow tinted with the artwork's own colour, so the two
          // posters do not sit under identical grey boxes.
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
        </div>
      </div>

      <div className="mt-7">
        {show.brand ? (
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.26em] text-[var(--paper-faint)]">
            {show.brand}
          </p>
        ) : null}
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
