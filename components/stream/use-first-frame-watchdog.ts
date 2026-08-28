"use client";

import * as React from "react";

import { hasDecodedFirstFrame, readPlaybackState } from "@/lib/media/playback-health";

/**
 * How long a creative gets to show its first frame before the channel takes
 * the screen back.
 *
 * Long enough that a slow connection is not punished for buffering, short
 * enough that nobody sits in front of a black rectangle wondering whether the
 * site is broken. The stall watchdog next door allows twelve seconds for a feed
 * that was already playing to resume; a creative that has never started gets
 * less, because there is nothing to lose by giving up on it.
 */
export const FIRST_FRAME_GRACE_SEC = 8;

/**
 * Give the screen back when a creative never starts.
 *
 * Both ad layers recovered from one signal, `onError`, and the file that broke
 * the channel never sent it: an mp4 with its index at the end downloads for
 * ever without erroring, so `onError` never fires, the layer never comes down,
 * and off air showed black for as long as the tab was open.
 *
 * Re-arms on `creativeKey`, so a second creative after a failed one gets its
 * own grace period rather than inheriting the first one's clock.
 */
export function useFirstFrameWatchdog({
  videoRef,
  armed,
  creativeKey,
  seconds = FIRST_FRAME_GRACE_SEC,
  onStall,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** True only while a creative is on screen. */
  armed: boolean;
  /** Changing this starts the clock again. */
  creativeKey: string | null;
  seconds?: number;
  onStall: () => void;
}) {
  /*
   * Held in a ref so a caller passing an inline function does not restart the
   * clock on every render, which would mean the deadline never arrives.
   */
  const stall = React.useRef(onStall);
  React.useEffect(() => {
    stall.current = onStall;
  }, [onStall]);

  React.useEffect(() => {
    if (!armed || !creativeKey) return;
    const id = setTimeout(() => {
      if (!hasDecodedFirstFrame(readPlaybackState(videoRef.current))) stall.current();
    }, seconds * 1000);
    return () => clearTimeout(id);
  }, [armed, creativeKey, seconds, videoRef]);
}
