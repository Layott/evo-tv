import { describe, expect, it } from "vitest";

import { filterMaster, suffixOf } from "@/lib/video/master-playlist";

/**
 * The ladder is a cost decision: a 1080p viewer costs roughly seven times a
 * 360p one. Until now `premiumOnly` was a label on an admin screen and nothing
 * withheld anything, so these are the tests that make the rule real.
 */

const ORIGIN = "https://api.evotv.co/hls/stream_abc.m3u8";

/** What production actually serves, taken off the wire on 20 August. */
const MASTER = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1000000,RESOLUTION=640x360",
  "stream_abc_low.m3u8",
  "#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1800000,RESOLUTION=854x480",
  "stream_abc_mid.m3u8",
  "#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=3200000,RESOLUTION=1280x720",
  "stream_abc_hi.m3u8",
  "#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=5600000,RESOLUTION=1920x1080",
  "stream_abc_fhd.m3u8",
].join("\n");

describe("suffixOf", () => {
  it("reads the rung off a variant name", () => {
    expect(suffixOf("stream_abc_low.m3u8")).toBe("_low");
    expect(suffixOf("https://cdn/x/stream_abc_fhd.m3u8?token=1")).toBe("_fhd");
  });

  it("returns null for a single-rung broadcast", () => {
    expect(suffixOf("stream_abc.m3u8")).toBeNull();
  });
});

describe("filterMaster", () => {
  it("gives a free viewer 360p and 480p only", () => {
    const out = filterMaster({ master: MASTER, originUrl: ORIGIN, hd: false });
    expect(out.playlist).toContain("stream_abc_low.m3u8");
    expect(out.playlist).toContain("stream_abc_mid.m3u8");
    expect(out.playlist).not.toContain("stream_abc_hi.m3u8");
    expect(out.playlist).not.toContain("stream_abc_fhd.m3u8");
    expect(out.keptVariants).toBe(2);
    expect(out.droppedForTier).toBe(2);
  });

  it("gives a subscriber every rung", () => {
    const out = filterMaster({ master: MASTER, originUrl: ORIGIN, hd: true });
    expect(out.keptVariants).toBe(4);
    expect(out.droppedForTier).toBe(0);
  });

  it("drops the STREAM-INF line with its URI, not just the URI", () => {
    const out = filterMaster({ master: MASTER, originUrl: ORIGIN, hd: false });
    // A left-behind header would make the player ask for the next line, which
    // is another rung's header, and the playlist stops parsing.
    expect(out.playlist).not.toContain("RESOLUTION=1280x720");
    expect(out.playlist).not.toContain("RESOLUTION=1920x1080");
    expect(out.playlist.split("#EXT-X-STREAM-INF").length - 1).toBe(2);
  });

  it("makes variant URIs absolute against the origin", () => {
    const out = filterMaster({ master: MASTER, originUrl: ORIGIN, hd: true });
    expect(out.playlist).toContain("https://api.evotv.co/hls/stream_abc_low.m3u8");
  });

  it("drops rungs that are advertised but not publishing", () => {
    // Production advertises _fhd whether or not the encoder sends it, and a
    // player that picks it sits on a black screen.
    const publishing = new Set([
      "https://api.evotv.co/hls/stream_abc_low.m3u8",
      "https://api.evotv.co/hls/stream_abc_mid.m3u8",
      "https://api.evotv.co/hls/stream_abc_hi.m3u8",
    ]);
    const out = filterMaster({ master: MASTER, originUrl: ORIGIN, hd: true, publishing });
    expect(out.playlist).not.toContain("stream_abc_fhd.m3u8");
    expect(out.droppedNotPublishing).toBe(1);
    expect(out.keptVariants).toBe(3);
  });

  it("carries the header and anything it does not understand", () => {
    const withMedia = [
      "#EXTM3U",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="English",DEFAULT=YES',
      "#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=640x360",
      "stream_abc_low.m3u8",
    ].join("\n");
    const out = filterMaster({ master: withMedia, originUrl: ORIGIN, hd: false });
    expect(out.playlist).toContain("#EXTM3U");
    expect(out.playlist).toContain("#EXT-X-MEDIA:TYPE=AUDIO");
  });

  it("leaves a single-rung broadcast alone", () => {
    const single = [
      "#EXTM3U",
      "#EXT-X-STREAM-INF:BANDWIDTH=2600000,RESOLUTION=1280x720",
      "stream_abc.m3u8",
    ].join("\n");
    // No suffix means nothing to gate: an encoder that was never reconfigured
    // for the ladder keeps working exactly as it did.
    const out = filterMaster({ master: single, originUrl: ORIGIN, hd: false });
    expect(out.keptVariants).toBe(1);
    expect(out.droppedForTier).toBe(0);
  });
});
