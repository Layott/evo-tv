import Link from "next/link";
import type { ScheduleEntry } from "@/lib/epg/grid";
import { PILLARS } from "./pillar";

interface Props {
  onAir: ScheduleEntry | null;
  next: ScheduleEntry | null;
}

/**
 * Hero plus the on-air band, deliberately one block.
 *
 * The band is the page's proof: a visitor who has never heard of EVO TV should
 * see a real programme name and a real time within the first screen, not a
 * marketing claim. When the grid has not been imported the band collapses
 * rather than rendering a placeholder, so an unseeded environment reads as
 * unfinished instead of broken.
 */
export default function Hero({ onAir, next }: Props) {
  const accent = onAir ? PILLARS[onAir.pillar].accent : PILLARS.esports.accent;

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.20),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-400">
          Streaming 24/7
        </p>

        <h1 className="mt-5 max-w-3xl text-balance text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
          Africa&apos;s home for esports, anime and lifestyle.
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
          One channel, always on. League nights, watch-alongs and the creators
          around them, running to a schedule you can plan your evening by.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* Anchors the week grid further down this page. There is no
              `/schedule` route — the spec assumed one, but the app only ships
              `/api/schedule`, and `/schedule` returns 404. */}
          <a
            href="#week"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#05091a] transition-transform hover:scale-[1.02] active:scale-95"
          >
            See what&apos;s on
          </a>
          <Link
            href="/signup"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Create an account
          </Link>
        </div>

        {onAir ? (
          <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
            <div className="flex flex-col divide-y divide-white/10 sm:flex-row sm:divide-x sm:divide-y-0">
              <OnAirCell
                label="On now"
                accent={accent}
                live
                time={`${onAir.startLabel} – ${onAir.endLabel}`}
                title={onAir.title}
                subtitle={onAir.subtitle}
                pillar={PILLARS[onAir.pillar].label}
              />
              {next ? (
                <OnAirCell
                  label="Up next"
                  accent={PILLARS[next.pillar].accent}
                  time={next.startLabel}
                  title={next.title}
                  subtitle={next.subtitle}
                  pillar={PILLARS[next.pillar].label}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OnAirCell({
  label,
  accent,
  live = false,
  time,
  title,
  subtitle,
  pillar,
}: {
  label: string;
  accent: string;
  live?: boolean;
  time: string;
  title: string;
  subtitle: string;
  pillar: string;
}) {
  return (
    <div className="flex-1 px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        {live ? (
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: accent }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
          </span>
        ) : null}
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-neutral-500">
          {time}
        </span>
      </div>

      <p className="mt-2.5 text-lg font-bold leading-snug text-white sm:text-xl">
        {title}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        {subtitle ? `${subtitle} · ${pillar}` : pillar}
      </p>
    </div>
  );
}
