import Link from "next/link";
import type { ScheduleEntry } from "@/lib/epg/grid";
import { PILLARS } from "./pillar";

interface Props {
  onAir: ScheduleEntry | null;
  next: ScheduleEntry | null;
  /** Titles for the ticker, in running order from now. */
  upcoming: ScheduleEntry[];
}

/**
 * Hero plus the on-air bug.
 *
 * The headline opens the page with nothing above it. There used to be a
 * "LAGOS · STREAMING 24/7" eyebrow set in tracked-out uppercase mono, which is
 * the single most recognisable generated-landing-page element there is. The
 * facts it carried are already in the subheading and the footer.
 *
 * The bug is a full-bleed bar carrying the wordmark's own blue-to-mint gradient,
 * the way a broadcast lower-third is a solid field rather than an outlined box.
 *
 * When the grid has not been imported the bar collapses rather than rendering a
 * placeholder, so an unseeded environment looks unfinished, not broken.
 */
export default function Hero({ onAir, next, upcoming }: Props) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[92rem] px-5 pb-16 pt-6 sm:px-10 sm:pb-24 sm:pt-10">
        <h1 className="wipe landing-display max-w-[16ch] text-[clamp(3.1rem,11.5vw,9.5rem)]">
          Africa&apos;s home for{" "}
          <span className="text-[var(--brand)]">esports</span>, anime and
          lifestyle.
        </h1>

        <div
          className="reveal mt-10 flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between"
          style={{ animationDelay: "260ms" }}
        >
          <div className="max-w-[46ch]">
            <p className="text-[1.02rem] leading-relaxed text-[var(--paper-dim)]">
              One channel, always on, out of Lagos. League nights, watch-alongs
              and the creators around them, running to a schedule you can plan
              your evening by.
            </p>
            {/* An announcement, not furniture. It sits in the flow under the
                subheading rather than in a bordered box or a second coloured
                bar, which would compete with the on-air bug directly below. */}
            <p className="landing-display mt-6 text-[1.35rem] text-[var(--brand)]">
              EVO TV is coming soon to UCH.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Anchors the week grid further down this page. There is no
                `/schedule` route - the spec assumed one, but the app only ships
                `/api/schedule`, and `/schedule` returns 404. */}
            <a
              href="#week"
              className="landing-display bg-[var(--brand)] px-7 py-3.5 text-[1.15rem] text-[var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              See what&apos;s on
            </a>
            <Link
              href="/signup"
              className="landing-display px-2 py-3.5 text-[1.15rem] text-[var(--paper)] underline decoration-[var(--paper-faint)] decoration-2 underline-offset-[6px] transition-colors hover:decoration-[var(--brand)]"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>

      {onAir ? <OnAirBug onAir={onAir} next={next} upcoming={upcoming} /> : null}
    </section>
  );
}

function OnAirBug({ onAir, next, upcoming }: Props & { onAir: ScheduleEntry }) {
  // Duplicated once so the marquee can translate -50% and loop seamlessly.
  const ticker = [...upcoming, ...upcoming];

  return (
    <div className="relative">
      <div className="bar-in brand-bar" style={{ animationDelay: "420ms" }}>
        <div className="mx-auto flex max-w-[92rem] flex-col gap-6 px-5 py-7 sm:flex-row sm:items-center sm:gap-10 sm:px-10 sm:py-8">
          <div className="flex shrink-0 items-center gap-3.5">
            {/* Uppercase survives here because a broadcast bug genuinely is
                set this way. The tracking is normal, not blown out. */}
            <span className="landing-display bg-[var(--ink)] px-2.5 py-1 text-[0.85rem] uppercase tracking-[0.04em] text-[var(--brand)]">
              On now
            </span>
            <span className="font-mono text-[0.82rem] tabular-nums text-[var(--ink)]/70">
              {onAir.startLabel}-{onAir.endLabel}
            </span>
          </div>

          <p className="landing-display min-w-0 flex-1 text-[clamp(1.6rem,4.2vw,2.6rem)]">
            {onAir.title}
            {onAir.subtitle ? (
              <span className="text-[var(--ink)]/55"> · {onAir.subtitle}</span>
            ) : null}
          </p>

          {next ? (
            <div className="shrink-0 sm:text-right">
              <p className="landing-display text-[0.95rem] text-[var(--ink)]/65">
                Up next,{" "}
                <span className="font-mono tabular-nums">{next.startLabel}</span>
              </p>
              <p className="landing-display mt-1 text-[1.2rem]">{next.title}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Running order ticker. Broadcast furniture, and it carries real titles
          rather than decorative text. */}
      {ticker.length > 0 ? (
        <div className="overflow-hidden bg-[var(--ink-raised)] py-3.5">
          <div className="marquee-track flex w-max items-baseline gap-8 whitespace-nowrap">
            {ticker.map((entry, i) => (
              <span
                key={`${entry.id}_${i}`}
                className="flex items-baseline gap-3 pr-8 text-[0.92rem]"
              >
                <span className="font-mono text-[0.8rem] tabular-nums text-[var(--brand)]">
                  {entry.startLabel}
                </span>
                <span className="landing-display text-[var(--paper-dim)]">
                  {entry.title}
                </span>
                <span className="text-[0.82rem] text-[var(--paper-faint)]">
                  {PILLARS[entry.pillar].label}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
