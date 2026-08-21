"use client";

import * as React from "react";

import { currentRung } from "@/lib/video/current-rung";

/**
 * Tell the server someone is watching.
 *
 * `POST /api/streams/[id]/heartbeat` and the read-time count that reads it were
 * both already built, and the native app already called this every 60s. The web
 * player never did, so every viewer watching on the website was invisible and
 * the live viewer count rendered whatever integer happened to be on the row,
 * which is zero.
 *
 * The endpoint dedupes per minute bucket per viewer, so a duplicate beat inside
 * the same minute is free. `DELETE` on unmount drops this viewer's recent rows
 * so the count falls immediately instead of waiting out the 90s window.
 *
 * Beats pause while the tab is hidden. A backgrounded tab is not an audience,
 * and browsers throttle timers there anyway, which would have produced a slow
 * drift of phantom viewers.
 */
const INTERVAL_MS = 60_000;

export function useStreamHeartbeat(
  streamId: string | undefined,
  active: boolean,
) {
  React.useEffect(() => {
    if (!streamId || !active) return;

    let stopped = false;

    const beat = () => {
      if (stopped || document.visibilityState !== "visible") return;
      /*
       * The rung rides along, when the player has settled on one.
       *
       * `watch_events.rung` was built for this and had been null on every row
       * ever written, because the beat sent no body. It is what turns "how many
       * people watched" into "and how much bandwidth that cost".
       */
      const rung = currentRung(streamId);
      void fetch(`/api/streams/${streamId}/heartbeat`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "content-type": "application/json" },
        /*
         * The browser is asked for the little it knows about itself and the
         * server reads the rest out of the user agent. `platform: "web"` is
         * the one thing worth saying explicitly, because it is what separates
         * these beats from the app's in every breakdown.
         */
        body: JSON.stringify({
          ...(rung ? { rung } : {}),
          platform: "web",
        }),
      }).catch(() => {
        // A missed beat costs one minute of attribution. Never surface it.
      });
    };

    beat();
    const timer = setInterval(beat, INTERVAL_MS);
    // Send one immediately on return so the viewer reappears without waiting
    // out a full interval.
    document.addEventListener("visibilitychange", beat);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
      // keepalive so the request survives the page being navigated away from.
      void fetch(`/api/streams/${streamId}/heartbeat`, {
        method: "DELETE",
        credentials: "include",
        keepalive: true,
      }).catch(() => {});
    };
  }, [streamId, active]);
}
