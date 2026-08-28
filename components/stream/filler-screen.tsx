"use client";

import * as React from "react";

import type { Ad } from "@/lib/types";
import { looksLikeVideo } from "@/lib/media/file-kind";
import { useFirstFrameWatchdog } from "@/components/stream/use-first-frame-watchdog";

/**
 * What plays when the channel is showing nothing.
 *
 * The filler was wired to one case only: a feed that drops while the stream is
 * still marked live, on the home page hero, which is the one surface that
 * mounted it. Stop the encoder and `isLive` goes false, that whole subtree
 * unmounts, and the viewer gets a line of text saying "Not currently live". On
 * the watch page there was no filler at all, because nothing there ever mounted
 * it. So "the filler does not play when nothing is on" was true, in the two
 * situations most likely to be tested.
 *
 * This is the off-air half: no live feed, so the `live_filler` creative loops
 * in the player's place. `children` is the old text, and it is what shows when
 * there is no creative, when the file will not play, or when the operator has
 * turned filler off.
 */
export function FillerScreen({
  children,
  label = "Back shortly",
  enabled = true,
}: {
  children: React.ReactNode;
  label?: string;
  /**
   * False renders the children untouched.
   *
   * The off-air card and the "live now, sign in to watch" card are the same
   * branch on the home page, and covering the second one with filler would
   * hide the reason a signed-out visitor cannot see the picture.
   */
  enabled?: boolean;
}) {
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [failed, setFailed] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  /*
   * A creative that never starts is a failure, even though nothing errors.
   *
   * The filler that shipped was 78 MB with its index at the end, so the browser
   * had to download all of it before it could decode a frame. It raised no
   * error, `onError` never fired, and off air showed a black rectangle instead
   * of the poster and the time the channel comes back.
   */
  useFirstFrameWatchdog({
    videoRef,
    armed: enabled && !!ad && !failed,
    creativeKey: ad?.id ?? null,
    onStall: () => setFailed(true),
  });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [breaksRes, adRes] = await Promise.all([
          fetch("/api/channel/breaks", { cache: "no-store" }),
          fetch("/api/ads/serve?placement=live_filler", { cache: "no-store" }),
        ]);
        const breaks = breaksRes.ok
          ? ((await breaksRes.json()) as { fillerOnDrop?: boolean; adFree?: boolean })
          : null;
        // Off by the operator's switch, or the viewer pays not to see ads.
        if (!breaks?.fillerOnDrop || breaks.adFree) return;

        const body = adRes.ok ? ((await adRes.json()) as { ad: Ad | null }) : null;
        const next = body?.ad ?? null;
        // A still cannot loop in a video tag. The ads form refuses to save one
        // against this placement now; rows saved before it did still exist.
        if (!cancelled && next && looksLikeVideo(next.mediaUrl)) setAd(next);
      } catch {
        /* the text below is the answer when anything here fails */
      }
    }

    if (enabled) void load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !ad || failed) return <>{children}</>;

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        key={ad.id}
        ref={videoRef}
        src={ad.mediaUrl}
        className="h-full w-full object-contain"
        autoPlay
        loop
        muted
        playsInline
        onError={() => setFailed(true)}
      />
      <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-[0.7rem] text-white/80">
        {label}
      </span>
    </div>
  );
}
