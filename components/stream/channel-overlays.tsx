"use client";

import * as React from "react";

import type { OverlayStyle, UpNextStyle } from "@/lib/channel-breaks";

/**
 * The channel's on-air furniture: a lower third while a programme runs, and a
 * full-screen card between programmes.
 *
 * One definition, used by the player and by the admin preview, so what an
 * operator picks is exactly what a viewer sees. Ten layouts, chosen by the
 * owner from a preview built over real footage.
 *
 * Nothing here is written per show. The words arrive as props from the
 * schedule: the programme name from the show record, the second line from the
 * slot, the time from the grid, the accent from the pillar. A show added this
 * afternoon appears tonight with nothing redrawn.
 *
 * Motion is entrance only, and every animation is suppressed under
 * `prefers-reduced-motion`, where each card simply holds its final state.
 */

export interface OverlayCopy {
  /** The programme being announced. */
  title: string;
  /** The slot's own second line: which game, whose session. May be empty. */
  subtitle?: string;
  /** `HH:MM` in the channel's clock. */
  startLabel: string;
  /** What is on right now, when the design says both. */
  nowTitle?: string;
  /** Minutes the programme runs, when the design has room for it. */
  durationMin?: number;
  /** Poster for the designs that carry artwork. */
  posterUrl?: string;
  /** esports | anime | lifestyle, deciding the accent. */
  pillar?: string;
  /** The rest of the evening, for the line-up card. */
  lineup?: { startLabel: string; title: string }[];
  /** Optional artwork behind the card, uploaded by the operator. */
  templateUrl?: string;
}

const PILLAR_COLOR: Record<string, string> = {
  esports: "var(--brand,#46e3ce)",
  anime: "#ff5c8a",
  lifestyle: "#ffb43d",
};

function accentFor(pillar?: string): string {
  return PILLAR_COLOR[pillar ?? ""] ?? PILLAR_COLOR.esports!;
}

/* ------------------------------------------------------------------ */
/* Lower third                                                         */
/* ------------------------------------------------------------------ */

export function LowerThird({
  style,
  copy,
}: {
  style: OverlayStyle;
  copy: OverlayCopy;
}) {
  const accent = accentFor(copy.pillar);
  const label = copy.nowTitle ? "Up next" : "On now";

  if (style === "ticker") {
    return (
      <div
        className="ovl-ticker pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-black"
        style={{ backgroundColor: accent }}
      >
        <span>{label}</span>
        <Dot />
        <span className="tabular-nums">{copy.startLabel}</span>
        <Dot />
        <span className="truncate text-[0.95rem] font-black normal-case tracking-tight">
          {copy.title}
        </span>
        {copy.subtitle ? (
          <>
            <Dot />
            <span className="truncate">{copy.subtitle}</span>
          </>
        ) : null}
      </div>
    );
  }

  if (style === "slab") {
    return (
      <div className="ovl-slab pointer-events-none absolute bottom-5 left-5 z-10 flex max-w-[78%] overflow-hidden rounded-xl">
        <div
          className="grid place-items-center px-4 text-base font-semibold tabular-nums text-black"
          style={{ backgroundColor: "#ffd84d" }}
        >
          {copy.startLabel}
        </div>
        <div className="bg-black/90 px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/60">
            {label}
          </p>
          <p className="text-lg font-black leading-tight text-white">{copy.title}</p>
          {copy.subtitle ? (
            <p className="text-xs" style={{ color: accent }}>
              {copy.subtitle}
              {copy.durationMin ? ` · ${formatRuntime(copy.durationMin)}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (style === "plate") {
    return (
      <div className="ovl-plate pointer-events-none absolute bottom-5 left-5 z-10 flex max-w-[74%] items-center gap-3 rounded-2xl bg-black/90 p-3">
        <div
          className="grid aspect-[2/3] w-14 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-semibold text-black"
          style={{ backgroundColor: accent }}
        >
          {copy.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- an arbitrary
            // poster URL, which next/image would need a remotePatterns entry for.
            <img src={copy.posterUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            "EVO"
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: accent }}>
            {label}
          </p>
          <p className="truncate text-lg font-black leading-tight text-white">
            {copy.title}
          </p>
          <p className="text-[0.7rem] tabular-nums text-white/60">
            {copy.startLabel}
            {copy.durationMin ? ` · ${formatRuntime(copy.durationMin)}` : ""}
            {copy.pillar ? ` · ${capitalise(copy.pillar)}` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (style === "stack") {
    return (
      <div className="ovl-stack pointer-events-none absolute bottom-5 left-5 z-10 flex max-w-[76%] flex-col items-start gap-2">
        {copy.nowTitle ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white">
            <span className="h-2 w-2 rounded-full bg-white" />
            On now · {copy.nowTitle}
          </span>
        ) : null}
        <span
          className="rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-black"
          style={{ backgroundColor: accent }}
        >
          Up next {copy.startLabel}
        </span>
        <div className="rounded-xl bg-black/90 px-4 py-2.5 text-lg font-black leading-tight text-white">
          {copy.title}
        </div>
      </div>
    );
  }

  // bar, the default
  return (
    <div className="ovl-bar pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-stretch bg-black/90">
      <div
        className="flex items-center px-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-black"
        style={{ backgroundColor: accent }}
      >
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-4 px-4 py-3">
        <span className="text-sm tabular-nums" style={{ color: accent }}>
          {copy.startLabel}
        </span>
        <span className="truncate text-xl font-black tracking-tight text-white">
          {copy.title}
        </span>
        {copy.subtitle ? (
          <span className="hidden truncate text-sm text-white/60 sm:inline">
            {copy.subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full screen                                                         */
/* ------------------------------------------------------------------ */

export function UpNextCard({
  style,
  copy,
  secondsToStart,
}: {
  style: UpNextStyle;
  copy: OverlayCopy;
  /** Only the countdown uses it; the others ignore it. */
  secondsToStart?: number;
}) {
  const accent = accentFor(copy.pillar);
  const art = copy.templateUrl || copy.posterUrl;

  if (style === "band") {
    return (
      <div className="ovl-fs absolute inset-0 z-20 bg-black">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element -- see above
          <img src={art} alt="" className="ovl-drift h-full w-full object-cover" />
        ) : null}
        <div className="ovl-band absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-black/90 px-8 py-6">
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: accent }}>
              Up next
            </p>
            <p className="truncate text-3xl font-black tracking-tight text-white">
              {copy.title}
            </p>
            {copy.subtitle ? (
              <p className="truncate text-sm text-white/60">{copy.subtitle}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-2xl font-semibold tabular-nums" style={{ color: "#ffd84d" }}>
            {copy.startLabel}
          </p>
        </div>
      </div>
    );
  }

  if (style === "split") {
    return (
      <div className="ovl-fs absolute inset-0 z-20 flex bg-black">
        <div className="ovl-pillar w-3 shrink-0" style={{ backgroundColor: accent }} />
        <div className="ovl-left flex w-[46%] flex-col justify-center gap-1 px-8">
          <p className="text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: accent }}>
            Up next
          </p>
          <p className="text-3xl font-black leading-tight tracking-tight text-white">
            {copy.title}
          </p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: "#ffd84d" }}>
            {copy.startLabel}
            {copy.durationMin ? ` · ${formatRuntime(copy.durationMin)}` : ""}
          </p>
        </div>
        <div className="relative flex-1 overflow-hidden">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img src={art} alt="" className="ovl-settle h-full w-full object-cover" />
          ) : null}
        </div>
      </div>
    );
  }

  if (style === "countdown") {
    return (
      <div className="ovl-fs absolute inset-0 z-20 flex flex-col justify-center gap-1 bg-black px-10">
        <div
          className="absolute inset-y-0 left-0 w-3"
          style={{ backgroundColor: "#ffd84d" }}
        />
        <p className="text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: accent }}>
          Starts in
        </p>
        <p
          className="ovl-mask text-7xl font-semibold leading-none tabular-nums"
          style={{ color: accent }}
        >
          {formatCountdown(secondsToStart)}
        </p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{copy.title}</p>
        <span
          className="mt-3 w-fit rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-black"
          style={{ backgroundColor: accent }}
        >
          {capitalise(copy.pillar ?? "esports")} · {copy.startLabel}
        </span>
      </div>
    );
  }

  if (style === "lineup") {
    const rows = copy.lineup?.length
      ? copy.lineup
      : [{ startLabel: copy.startLabel, title: copy.title }];
    return (
      <div className="ovl-fs absolute inset-0 z-20 flex flex-col justify-center gap-3 bg-black px-10">
        <p className="text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: accent }}>
          Coming up on EVO TV
        </p>
        {rows.slice(0, 4).map((row, i) => (
          <div key={`${row.startLabel}-${row.title}`} className="ovl-row flex items-baseline gap-5">
            <span
              className="w-20 shrink-0 tabular-nums"
              style={{ color: i === 0 ? "#ffd84d" : "rgba(255,255,255,.5)" }}
            >
              {row.startLabel}
            </span>
            <span
              className={
                i === 0
                  ? "truncate text-3xl font-black tracking-tight text-white"
                  : "truncate text-lg font-bold text-white/50"
              }
            >
              {row.title}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // centre, the default
  return (
    <div className="ovl-fs absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black px-10 text-center">
      <p className="ovl-letters text-[0.7rem] uppercase" style={{ color: accent }}>
        Up next
      </p>
      <p className="ovl-mask text-5xl font-black leading-none tracking-tight text-white">
        {copy.title}
      </p>
      <p className="text-xl font-semibold tabular-nums" style={{ color: "#ffd84d" }}>
        {copy.startLabel}
        {copy.durationMin ? ` · ${formatRuntime(copy.durationMin)}` : ""}
      </p>
      {copy.lineup && copy.lineup.length > 1 ? (
        <p className="mt-4 text-xs text-white/50">
          Then{" "}
          {copy.lineup
            .slice(1, 3)
            .map((row) => `${row.startLabel} ${row.title}`)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Dot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/70" />;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "2 hours", "90 min". Broadcast reads hours; anything under one reads minutes. */
export function formatRuntime(minutes: number): string {
  if (minutes >= 120 && minutes % 60 === 0) return `${minutes / 60} hours`;
  if (minutes === 60) return "1 hour";
  return `${minutes} min`;
}

function formatCountdown(seconds?: number): string {
  const safe = Math.max(0, Math.round(seconds ?? 0));
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${m}:${s}`;
}
