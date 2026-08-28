import { describe, expect, it } from "vitest";

import { hasDecodedFirstFrame } from "@/lib/media/playback-health";

/**
 * Whether a player has actually put a picture on the screen.
 *
 * The channel's ad layers only ever recovered from `onError`. A file that
 * stalls without erroring never fires it, so the layer held the screen for as
 * long as the tab stayed open. That is what the live filler did: a 78 MB file
 * with its index at the end downloaded quietly for ever, raised nothing, and
 * the viewer got a black rectangle.
 *
 * So the question is never "is the element healthy". It is "has a frame
 * arrived", which is what these cases pin down.
 */
describe("hasDecodedFirstFrame", () => {
  /*
   * The exact state read off prod while the filler was stuck: nineteen seconds
   * after mount, still downloading, nothing buffered, no error raised.
   */
  it("is false for the stalled filler, which reported no error at all", () => {
    expect(
      hasDecodedFirstFrame({ readyState: 0, videoWidth: 0, error: null }),
    ).toBe(false);
  });

  it("is false on a fresh mount", () => {
    expect(hasDecodedFirstFrame({ readyState: 0, videoWidth: 0, error: null })).toBe(false);
  });

  /*
   * Dimensions arrive with the metadata, before any frame is decoded. Treating
   * a known width as a picture would call the stall a success one step early.
   */
  it("is false once dimensions are known but no frame is decoded", () => {
    expect(hasDecodedFirstFrame({ readyState: 1, videoWidth: 1920, error: null })).toBe(false);
  });

  it("is true once the element holds current data", () => {
    expect(hasDecodedFirstFrame({ readyState: 2, videoWidth: 1920, error: null })).toBe(true);
    expect(hasDecodedFirstFrame({ readyState: 4, videoWidth: 1280, error: null })).toBe(true);
  });

  /*
   * A decode failure part way through leaves the last frame and its dimensions
   * in place, so the error has to outrank them.
   */
  it("is false when the element carries an error, whatever else it reports", () => {
    expect(
      hasDecodedFirstFrame({ readyState: 4, videoWidth: 1920, error: { code: 3 } }),
    ).toBe(false);
  });

  /*
   * An audio-only creative has no width and never will. It is not the filler's
   * job to play one, and the ads form refuses it, but the watchdog must not be
   * the thing that decides that.
   */
  it("trusts readyState when there is no video track to measure", () => {
    expect(
      hasDecodedFirstFrame({ readyState: 4, videoWidth: 0, error: null, hasVideoTrack: false }),
    ).toBe(true);
  });

  it("is false for an element that has gone away", () => {
    expect(hasDecodedFirstFrame(null)).toBe(false);
  });
});
