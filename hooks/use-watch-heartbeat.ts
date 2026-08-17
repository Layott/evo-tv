"use client";

import * as React from "react";

/**
 * Reports how far into a video the viewer has got, so the admin analytics page
 * can measure watch time and draw an audience retention curve.
 *
 * The server keys on (video, session, percent) and drops duplicates, so this
 * can be blunt: beat on a fixed interval while playing and let the primary key
 * do the deduplication. That is why there is no bookkeeping here about which
 * percentages have already been sent, and why seeking backwards is free.
 *
 * `sessionId` is per playback, not per account. It is what lets a signed-out
 * viewer count as one view rather than none, and it is deliberately not stored
 * anywhere: a reload is a new session, which is the same thing YouTube counts.
 *
 * Never throws into the player. A failed beat is a lost data point, and a lost
 * data point must not be able to interrupt a video.
 */

/**
 * Beat at least once per percent of the video, within reason.
 *
 * The server stores one row per percent reached and counts those rows as watch
 * time, so the beat has to be fine enough to actually land in every percent the
 * viewer passes through. A fixed ten seconds does not: on a three minute video
 * one percent is under two seconds, so five of every six percents were never
 * recorded and watch time came out roughly five times too low.
 *
 * Clamped at both ends. Ten seconds is the ceiling, because past about sixteen
 * minutes a percent is longer than that anyway. Two seconds is the floor, so a
 * thirty second clip does not beat three times a second.
 */
const MAX_BEAT_MS = 10_000;
const MIN_BEAT_MS = 2_000;

function beatIntervalMs(durationSec: number): number {
  const onePercentMs = (durationSec / 100) * 1000;
  return Math.min(MAX_BEAT_MS, Math.max(MIN_BEAT_MS, onePercentMs));
}

function newSessionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useWatchHeartbeat(
  video: HTMLVideoElement | null,
  analytics: { type: "vod" | "episode"; id: string } | undefined,
) {
  // Regenerated when the title changes, so playing a second video in the same
  // page does not merge into the first one's session.
  const sessionRef = React.useRef<string>("");
  const key = analytics ? `${analytics.type}:${analytics.id}` : "";

  React.useEffect(() => {
    sessionRef.current = newSessionId();
  }, [key]);

  React.useEffect(() => {
    if (!video || !analytics) return;

    let stopped = false;

    const beat = () => {
      if (stopped || video.paused || video.ended) return;
      const durationSec = video.duration;
      const positionSec = video.currentTime;
      // A live edge reports Infinity, and a manifest that has not loaded yet
      // reports NaN. Neither is a video with a percentage to report.
      if (!Number.isFinite(durationSec) || durationSec <= 0) return;
      if (!Number.isFinite(positionSec) || positionSec < 0) return;

      void fetch("/api/watch/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoType: analytics.type,
          videoId: analytics.id,
          sessionId: sessionRef.current,
          positionSec,
          durationSec,
        }),
        keepalive: true,
      }).catch(() => {
        /* A lost beat is a lost data point, not a playback problem. */
      });
    };

    // One immediately on play, so a short watch is not rounded away to nothing.
    const onPlay = () => beat();
    video.addEventListener("play", onPlay);

    /*
     * The interval depends on the runtime, which is not known until metadata
     * loads, so it is (re)started once that arrives rather than guessed at.
     */
    let timer: number | undefined;
    const startTimer = () => {
      if (timer !== undefined) window.clearInterval(timer);
      const duration = video.duration;
      const ms = Number.isFinite(duration) && duration > 0
        ? beatIntervalMs(duration)
        : MAX_BEAT_MS;
      timer = window.setInterval(beat, ms);
    };

    video.addEventListener("loadedmetadata", startTimer);
    startTimer();
    if (!video.paused) beat();

    return () => {
      stopped = true;
      if (timer !== undefined) window.clearInterval(timer);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("loadedmetadata", startTimer);
    };
  }, [video, analytics?.type, analytics?.id, key]);
}
