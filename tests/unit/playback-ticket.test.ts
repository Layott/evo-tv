import { describe, expect, it } from "vitest";

import { mintPlaybackTicket, readPlaybackTicket } from "@/lib/video/playback-ticket";

/**
 * The ticket is what tells the manifest route whether this viewer may see the
 * HD rungs, and it travels in a URL because the app's native player cannot
 * attach a bearer token to a manifest request. So the two things worth pinning
 * are that it cannot be forged and that a bad one costs somebody their HD
 * rather than their broadcast.
 */

const NOW = Date.parse("2026-08-20T18:00:00.000Z");

describe("playback ticket", () => {
  it("round-trips an HD viewer", () => {
    expect(readPlaybackTicket(mintPlaybackTicket(true, NOW), NOW).hd).toBe(true);
  });

  it("round-trips a free viewer", () => {
    expect(readPlaybackTicket(mintPlaybackTicket(false, NOW), NOW).hd).toBe(false);
  });

  it("refuses a ticket whose claim was edited", () => {
    const ticket = mintPlaybackTicket(false, NOW);
    const forged = `1${ticket.slice(1)}`;
    expect(readPlaybackTicket(forged, NOW).hd).toBe(false);
  });

  it("refuses a ticket with a made-up signature", () => {
    const [payload] = mintPlaybackTicket(true, NOW).split(".");
    expect(readPlaybackTicket(`${payload}.${"0".repeat(64)}`, NOW).hd).toBe(false);
  });

  it("expires", () => {
    const ticket = mintPlaybackTicket(true, NOW);
    expect(readPlaybackTicket(ticket, NOW + 40 * 60 * 1000).hd).toBe(true);
    expect(readPlaybackTicket(ticket, NOW + 50 * 60 * 1000).hd).toBe(false);
  });

  it("is byte-identical inside a bucket, so a poll cannot reload the player", () => {
    // Clients re-fetch the stream every 30 to 60 seconds. A ticket that
    // differed each time would change the player's `src` and restart playback,
    // so a viewer would see the picture stutter once a minute because of an
    // access decision that had not changed.
    const a = mintPlaybackTicket(true, NOW);
    const b = mintPlaybackTicket(true, NOW + 45_000);
    const c = mintPlaybackTicket(true, NOW + 9 * 60 * 1000);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(mintPlaybackTicket(true, NOW + 11 * 60 * 1000)).not.toBe(a);
  });

  it("treats nothing, junk and an empty string as a free viewer", () => {
    // Not an error: a stale URL should cost the HD rungs, not the stream.
    expect(readPlaybackTicket(null, NOW).hd).toBe(false);
    expect(readPlaybackTicket("", NOW).hd).toBe(false);
    expect(readPlaybackTicket("nonsense", NOW).hd).toBe(false);
    expect(readPlaybackTicket("1-999.", NOW).hd).toBe(false);
  });
});
