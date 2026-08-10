import Image from "next/image";
import type { ShowArt } from "@/lib/epg/artwork";
import { PILLARS } from "./pillar";

interface Props {
  shows: ShowArt[];
}

/**
 * The shows that have finished artwork.
 *
 * No times are attached. These titles are not on the April rotation, and giving
 * them an invented airtime so they could sit in the week grid would be the same
 * fabrication this page exists to avoid. When one of them is scheduled it picks
 * up its slot in the grid automatically via `gridTitles` in the artwork
 * registry, and the rail drops it.
 */
export default function Originals({ shows }: Props) {
  if (shows.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            EVO Originals
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Made here. Coming to the channel.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:gap-7">
        {shows.map((show) => (
          <PosterCard key={show.slug} show={show} />
        ))}
      </div>
    </section>
  );
}

function PosterCard({ show }: { show: ShowArt }) {
  return (
    <article className="group">
      <div
        className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 transition-shadow duration-300"
        style={{ boxShadow: `0 0 0 0 ${show.accent}00` }}
      >
        {/* 4:5, matching the delivered artwork exactly so nothing is cropped. */}
        <div className="relative aspect-[4/5] w-full">
          <Image
            src={show.poster}
            alt={`${show.title} poster`}
            fill
            // next.config sets images.unoptimized, so these are the WebP files
            // shipped in public/shows rather than anything resized at request time.
            sizes="(min-width: 640px) 50vw, 100vw"
            placeholder="blur"
            blurDataURL={show.blurDataURL}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </div>

        {/* A light poster on a dark page needs an edge, a dark one does not. */}
        {show.polarity === "light" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10"
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: show.accent }}
        />
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight text-white">
            {show.brand ? (
              <span className="text-neutral-500">{show.brand} · </span>
            ) : null}
            {show.title}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            {show.tagline ?? show.handle ?? PILLARS[show.pillar].label}
          </p>
        </div>
      </div>
    </article>
  );
}
