import type { ScheduleEntry } from "@/lib/epg/grid";
import { PILLARS } from "./pillar";

interface Props {
  onAir: ScheduleEntry | null;
  next: ScheduleEntry | null;
  /** Titles for the ticker, in running order from now. */
  upcoming: ScheduleEntry[];
}

/**
 * The on-air bug, and the line that introduces the channel.
 *
 * The headline, the UHF announcement and the buttons that used to open this
 * section now live in `video-opening.tsx`, over the reel. What is left is what
 * the opening screen cannot carry: a sentence of plain description for anyone
 * who scrolled past the pitch, and the bug itself.
 *
 * The bug is a full-bleed bar carrying the wordmark's own blue-to-mint gradient,
 * the way a broadcast lower-third is a solid field rather than an outlined box.
 * It sits directly under the opening deliberately, so the first thing below the
 * fold is the channel stating what is on.
 *
 * When the grid has not been imported the bar collapses rather than rendering a
 * placeholder, so an unseeded environment looks unfinished, not broken.
 */
export default function Hero({ onAir, next, upcoming }: Props) {
  return (
    <section className="relative">
      {onAir ? <OnAirBug onAir={onAir} next={next} upcoming={upcoming} /> : null}

      <div className="mx-auto max-w-[92rem] px-5 pb-4 pt-12 sm:px-10 sm:pt-16">
        <p className="reveal max-w-[46ch] text-[1.02rem] leading-relaxed text-[var(--paper-dim)]">
          One channel, always on, out of Lagos. League nights, watch-alongs and
          the creators around them, running to a schedule you can plan your
          evening by.
        </p>
      </div>
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
