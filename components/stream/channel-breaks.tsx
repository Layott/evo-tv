"use client";

import * as React from "react";
import { looksLikeVideo } from "@/lib/media/file-kind";
import { LowerThird, UpNextCard } from "@/components/stream/channel-overlays";
import { useFirstFrameWatchdog } from "@/components/stream/use-first-frame-watchdog";
import type { OverlayStyle, UpNextStyle } from "@/lib/channel-breaks-shape";

/**
 * The channel's rhythm, wrapped around the player.
 *
 * Three jobs a linear channel needs and a video page does not:
 *
 * 1. **A break at an interval.** Every `adIntervalMin`, an ad takes the screen
 *    for up to `adMaxSec`, then the live feed comes back at the live edge.
 * 2. **An on-air card.** Every `overlayIntervalMin`, a small card says what is
 *    on and what is next, for `overlayDurationSec`. This is the thing a viewer
 *    who tuned in mid-programme actually wants.
 * 3. **Filler when the feed drops.** The playout box is supposed to keep
 *    pushing so the manifest never dies. When it dies anyway, a viewer should
 *    see something running rather than a black rectangle, so the `live_filler`
 *    ads play on a loop while the live feed is retried behind them.
 *
 * It wraps rather than extends the player because the player is shared with
 * every other video on the site, and none of this belongs there. The one thing
 * it reaches through for is the `<video>` element itself, so the live audio can
 * be silenced while an ad is on top of it: an ad playing over the commentary is
 * worse than no ad at all.
 *
 * A viewer whose subscription is ad-free never sees 1 or 3, and the server
 * decides that, not this component.
 */

interface BreaksConfig {
  enabled: boolean;
  adIntervalMin: number;
  adMaxSec: number;
  overlayIntervalMin: number;
  overlayDurationSec: number;
  fillerOnDrop: boolean;
  adFree: boolean;
  lowerThirdStyles?: OverlayStyle[];
  lowerThirdStyle?: OverlayStyle;
  lowerThirdUrl?: string;
  upNextStyles?: UpNextStyle[];
  upNextStyle?: UpNextStyle;
  upNextUrl?: string;
  upNextLeadMin?: number;
  upNextSec?: number;
}

interface Ad {
  id: string;
  mediaUrl: string;
  clickUrl: string;
  advertiser: string;
}

interface NowNext {
  now: { title: string; subtitle: string; endLabel?: string } | null;
  next: {
    title: string;
    startLabel: string;
    /** ISO instant, so the full-screen card knows when to arrive. */
    airsAt?: string;
    subtitle?: string;
    durationMin?: number;
    pillar?: string;
    posterUrl?: string;
  } | null;
  /** The rest of the evening, for the line-up card. */
  lineup?: { startLabel: string; title: string }[];
}

/**
 * The layout for this appearance.
 *
 * An empty list means the operator switched that card off, and the caller has
 * already decided whether to render at all, so the fallback keeps it honest
 * rather than silently reviving a disabled card.
 */
function pickStyle<T extends string>(list: T[] | undefined, fallback: T, shown: number): T {
  if (!list || list.length === 0) return fallback;
  return list[shown % list.length]!;
}

/** How often the watchdog looks, and how long a still picture means a dead feed. */
const STALL_TICK_MS = 2_000;
const STALL_LIMIT_MS = 12_000;

interface Props {
  children: React.ReactNode;
  /** Shown on the on-air card. Passing null hides the card entirely. */
  nowNext?: NowNext | null;
}


async function fetchAd(placement: "mid_roll" | "live_filler"): Promise<Ad | null> {
  try {
    const res = await fetch(`/api/ads/serve?placement=${placement}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ad: Ad | null };
    return body.ad ?? null;
  } catch {
    return null;
  }
}

export function ChannelBreaks({ children, nowNext }: Props) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  /** The ad's own element, so the watchdog can ask whether it ever started. */
  const adVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [config, setConfig] = React.useState<BreaksConfig | null>(null);
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [adKind, setAdKind] = React.useState<"mid_roll" | "live_filler" | null>(null);
  const [cardVisible, setCardVisible] = React.useState(false);
  const [upNextVisible, setUpNextVisible] = React.useState(false);
  /*
   * Which layout this appearance uses.
   *
   * The owner wants all five in rotation rather than one chosen forever, and a
   * channel that shows the same card every twenty minutes for six hours teaches
   * people to stop reading it. Counting appearances rather than picking at
   * random means the sequence is predictable, which matters when somebody is
   * checking that a particular card looks right on air.
   */
  const lowerThirdShown = React.useRef(0);
  const upNextShown = React.useRef(0);
  const [secondsToNext, setSecondsToNext] = React.useState(0);
  /** The programme the full-screen card has already announced. */
  const announced = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/channel/breaks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: BreaksConfig | null) => {
        if (!cancelled && c) setConfig(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** The live `<video>` under this wrapper, whatever player rendered it. */
  const liveVideo = React.useCallback(
    () => wrapRef.current?.querySelector("video") ?? null,
    [],
  );

  const showAd = React.useCallback(
    async (kind: "mid_roll" | "live_filler") => {
      const next = await fetchAd(kind);
      // A still cannot play here, and the ads form now refuses to save one
      // against these placements. This stays as the backstop for the rows that
      // were saved before it did.
      if (!next || !looksLikeVideo(next.mediaUrl)) return false;
      const v = liveVideo();
      // Muted, not paused: a paused live stream falls behind and has to be
      // dragged back to the edge afterwards, and some players fight a pause.
      if (v) v.muted = true;
      setAd(next);
      setAdKind(kind);
      void fetch("/api/ads/impression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: next.id }),
      }).catch(() => {});
      return true;
    },
    [liveVideo],
  );

  const endAd = React.useCallback(() => {
    setAd(null);
    setAdKind(null);
    const v = liveVideo();
    if (!v) return;
    v.muted = false;
    // Rejoin the live edge. Falling a break behind on every break is how a
    // channel ends up ten minutes late by the evening.
    try {
      if (v.seekable.length > 0) {
        const edge = v.seekable.end(v.seekable.length - 1);
        if (Number.isFinite(edge) && edge - v.currentTime > 5) v.currentTime = edge;
      }
      void v.play().catch(() => {});
    } catch {
      /* a player mid-teardown is not worth an error */
    }
  }, [liveVideo]);

  /*
   * A creative that never shows a frame gives the channel back.
   *
   * `onError` below is the only thing that ended a broken ad, and the file that
   * broke the channel never errored: an mp4 with its index at the end downloads
   * silently and decodes nothing, so the layer sat over the player as a black
   * rectangle. `adMaxSec` would eventually lift a mid-roll, but filler loops
   * and has no such stop, which is how off air stayed black indefinitely.
   */
  useFirstFrameWatchdog({
    videoRef: adVideoRef,
    armed: !!ad,
    creativeKey: ad?.id ?? null,
    onStall: endAd,
  });

  // ------------------------------------------------------------ ad breaks
  React.useEffect(() => {
    if (!config?.enabled || config.adFree || config.adIntervalMin <= 0) return;
    const every = config.adIntervalMin * 60_000;
    const id = setInterval(() => {
      // Never interrupt filler with a break: the feed is already down.
      setAdKind((current) => {
        if (current === null) void showAd("mid_roll");
        return current;
      });
    }, every);
    return () => clearInterval(id);
  }, [config, showAd]);

  // Hard stop, so a broken ad file cannot hold the channel hostage.
  React.useEffect(() => {
    if (!ad || adKind !== "mid_roll" || !config) return;
    const id = setTimeout(endAd, config.adMaxSec * 1000);
    return () => clearTimeout(id);
  }, [ad, adKind, config, endAd]);

  /*
   * The full-screen card, in the last minutes before a programme starts.
   *
   * Once per programme, not on a cycle: an announcement that repeats every few
   * minutes stops being an announcement and becomes an interruption. The
   * programme's own start time is the key, so a schedule change re-arms it and
   * a page left open overnight does not replay last night's card.
   */
  React.useEffect(() => {
    if (config?.upNextStyles && config.upNextStyles.length === 0) return;
    const lead = config?.upNextLeadMin ?? 0;
    const airsAt = nowNext?.next?.airsAt;
    if (!lead || !airsAt) return;

    const tick = () => {
      const seconds = Math.round((new Date(airsAt).getTime() - Date.now()) / 1000);
      setSecondsToNext(Math.max(0, seconds));
      if (seconds <= 0 || seconds > lead * 60) return;
      if (announced.current === airsAt) return;
      announced.current = airsAt;
      upNextShown.current += 1;
      setUpNextVisible(true);
      setTimeout(() => setUpNextVisible(false), (config?.upNextSec ?? 10) * 1000);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config, nowNext]);

  // ------------------------------------------------------------ on-air card
  React.useEffect(() => {
    if (!config?.enabled || config.overlayIntervalMin <= 0 || !nowNext?.now) return;
    // An empty rotation is the operator turning the lower third off.
    if (config.lowerThirdStyles && config.lowerThirdStyles.length === 0) return;
    const every = config.overlayIntervalMin * 60_000;
    const id = setInterval(() => {
      lowerThirdShown.current += 1;
      setCardVisible(true);
      setTimeout(() => setCardVisible(false), config.overlayDurationSec * 1000);
    }, every);
    return () => clearInterval(id);
  }, [config, nowNext]);

  // ------------------------------------------------------------ filler
  React.useEffect(() => {
    /*
     * The filler does not wait for the master switch.
     *
     * "Cover a dropped feed with filler" was gated behind Channel breaks being
     * on, so an operator who uploaded a filler creative, left ad breaks off and
     * then lost the feed saw a black rectangle and an error. The two are
     * different jobs: breaks are advertising on a schedule, this is what covers
     * an outage, and nobody turns on advertising in order to handle an outage.
     */
    if (!config?.fillerOnDrop) return;
    const v = liveVideo();
    if (!v) return;

    let retry: ReturnType<typeof setInterval> | null = null;

    const onDrop = () => {
      setAdKind((current) => {
        if (current !== null) return current;
        void showAd("live_filler");
        return current;
      });
      // Keep asking for the feed. When it answers, the filler comes off.
      let resumeMark = v.currentTime;
      retry ??= setInterval(() => {
        // Moving again, not merely "ready": a stalled element keeps a healthy
        // readyState while the picture sits still. A feed that was never up
        // comes back as data arriving at all, which `currentTime` alone would
        // miss because it is still sitting at zero.
        const moving = v.currentTime > resumeMark + 0.25;
        const arrived = v.buffered.length > 0 && v.readyState >= 3;
        resumeMark = v.currentTime;
        if ((moving || arrived) && !v.error) {
          setAdKind((current) => {
            if (current === "live_filler") endAd();
            return current;
          });
          if (retry) {
            clearInterval(retry);
            retry = null;
          }
        }
      }, 5000);
    };

    /*
     * A feed that stops does not fire an error.
     *
     * nginx keeps a five minute playlist, so when the encoder stops the
     * manifest is still there and still 200: the player simply runs out of
     * segments and waits. No `error`, no `ended`, often not even `stalled`, so
     * the filler stayed off for the whole window the operator was watching.
     * The honest test is whether the picture is moving: if the clock has not
     * advanced while the video is meant to be playing, the feed is gone.
     */
    let lastTime = v.currentTime;
    let stuckFor = 0;
    const watchdog = setInterval(() => {
      /*
       * Never started counts as dropped.
       *
       * The first version of this only caught a picture that froze, so it did
       * nothing in the commonest case of all: arriving at the page while the
       * feed is already down. The manifest 404s, hls.js retries the network
       * error forever, and the element sits at `readyState` 0 holding no data,
       * paused, with a play button over a poster. That is not a viewer's pause
       * and it is exactly what the filler exists to cover.
       *
       * A viewer's pause always has data behind it, because they paused
       * something that was playing. Nothing buffered and nothing decoded is a
       * feed that never arrived.
       */
      const hasNothing = v.buffered.length === 0 && v.readyState < 2;
      if (v.paused && !hasNothing) {
        lastTime = v.currentTime;
        stuckFor = 0;
        return;
      }
      if (v.seeking) return;
      if (!hasNothing && v.currentTime > lastTime + 0.25) {
        lastTime = v.currentTime;
        stuckFor = 0;
        return;
      }
      stuckFor += STALL_TICK_MS;
      if (stuckFor >= STALL_LIMIT_MS) onDrop();
    }, STALL_TICK_MS);

    v.addEventListener("error", onDrop);
    v.addEventListener("ended", onDrop);
    v.addEventListener("stalled", onDrop);
    return () => {
      v.removeEventListener("error", onDrop);
      v.removeEventListener("ended", onDrop);
      v.removeEventListener("stalled", onDrop);
      clearInterval(watchdog);
      if (retry) clearInterval(retry);
    };
  }, [config, liveVideo, showAd, endAd]);

  return (
    <div ref={wrapRef} className="relative">
      {children}

      {ad ? (
        <div className="absolute inset-0 z-20 bg-black">
          <video
            key={ad.id}
            ref={adVideoRef}
            src={ad.mediaUrl}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            // Filler loops because the feed may be down for a while. A break
            // plays once and gives the channel back.
            loop={adKind === "live_filler"}
            onEnded={adKind === "mid_roll" ? endAd : undefined}
            onError={endAd}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
            <span className="rounded bg-black/70 px-2 py-1 text-[0.7rem] text-white/80">
              {adKind === "live_filler" ? "Back shortly" : "Ad"}
            </span>
            {ad.clickUrl ? (
              <a
                href={`/api/ads/click?adId=${encodeURIComponent(ad.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto rounded bg-sky-500 px-3 py-1 text-[0.8rem] font-semibold text-ink hover:bg-sky-600"
              >
                {ad.advertiser ? `Visit ${ad.advertiser}` : "Learn more"}
              </a>
            ) : null}
          </div>

          {adKind === "mid_roll" ? (
            <button
              type="button"
              onClick={endAd}
              className="absolute bottom-3 right-3 rounded bg-sky-500 px-3 py-1.5 text-[0.8rem] font-semibold text-ink hover:bg-sky-600"
            >
              Back to live
            </button>
          ) : null}
        </div>
      ) : null}

      {/*
        The lower third and the full-screen card, in the layouts the owner
        picked. Both are drawn by `channel-overlays.tsx`, which the admin
        preview uses as well, so what is chosen there is what goes out here.
      */}
      {cardVisible && nowNext?.next ? (
        <LowerThird
          style={pickStyle(
            config?.lowerThirdStyles,
            config?.lowerThirdStyle ?? "bar",
            lowerThirdShown.current,
          )}
          copy={{
            title: nowNext.next.title,
            subtitle: nowNext.next.subtitle,
            startLabel: nowNext.next.startLabel,
            nowTitle: nowNext.now?.title,
            durationMin: nowNext.next.durationMin,
            posterUrl: nowNext.next.posterUrl,
            pillar: nowNext.next.pillar,
            templateUrl: config?.lowerThirdUrl || undefined,
          }}
        />
      ) : null}

      {upNextVisible && nowNext?.next ? (
        <UpNextCard
          style={pickStyle(
            config?.upNextStyles,
            config?.upNextStyle ?? "centre",
            upNextShown.current,
          )}
          secondsToStart={secondsToNext}
          copy={{
            title: nowNext.next.title,
            subtitle: nowNext.next.subtitle,
            startLabel: nowNext.next.startLabel,
            durationMin: nowNext.next.durationMin,
            posterUrl: nowNext.next.posterUrl,
            pillar: nowNext.next.pillar,
            lineup: nowNext.lineup,
            templateUrl: config?.upNextUrl || undefined,
          }}
        />
      ) : null}
    </div>
  );
}
