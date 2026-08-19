/**
 * The quality ladder, as data.
 *
 * Pure on purpose. `ingest.ts` is `server-only`, and the admin screen needs the
 * same list to tell an operator what to publish: when it kept its own copy it
 * went on advertising 2200 / 900 / 400 kbps after the ladder was re-measured,
 * and it had no 1080p line at all. One list, beside the suffixes nginx matches
 * variants on.
 */
/**
 * The rungs of the quality ladder, as suffixes on the RTMP publish name.
 *
 * These must stay in step with the `hls_variant` lines in
 * `deploy/nginx-rtmp.conf` and `infra/nginx-rtmp/nginx.conf`. nginx decides
 * what a variant is from that config; this list only teaches the app to
 * recognise the same names coming back through the publish callbacks.
 */
export const HLS_VARIANT_SUFFIXES = ["_low", "_mid", "_hi", "_fhd"] as const;

/**
 * What an operator has to set up in OBS, vMix or ffplayout, per rung.
 *
 * The admin screen showed one server and one key, and the ladder needs one
 * publish per rung, so an operator had to know to append `_low`, `_mid` and
 * `_hi` themselves. Nothing on the screen said so, and 1080p had no line at
 * all.
 *
 * The bitrates are what nginx advertises in `hls_variant BANDWIDTH`, and that
 * number comes from the config rather than from the stream: an encoder that
 * overshoots makes the playlist lie to players, which is worse than no ladder.
 * These are the targets to set, not suggestions.
 */
export interface RungSpec {
  suffix: (typeof HLS_VARIANT_SUFFIXES)[number];
  label: string;
  resolution: string;
  videoKbps: number;
  audioKbps: number;
  /** Premium-only rungs cost roughly seven times a 360p viewer against the allowance. */
  premiumOnly: boolean;
}

export const RUNGS: RungSpec[] = [
  { suffix: "_low", label: "360p", resolution: "640x360", videoKbps: 800, audioKbps: 96, premiumOnly: false },
  { suffix: "_mid", label: "480p", resolution: "854x480", videoKbps: 1400, audioKbps: 128, premiumOnly: false },
  { suffix: "_hi", label: "720p", resolution: "1280x720", videoKbps: 2800, audioKbps: 128, premiumOnly: false },
  { suffix: "_fhd", label: "1080p", resolution: "1920x1080", videoKbps: 5000, audioKbps: 160, premiumOnly: true },
];

