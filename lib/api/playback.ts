import "server-only";

import type { Stream } from "@/lib/types";

/**
 * Watching requires an account, so the playback URL is not public.
 *
 * Enforced on every endpoint that returns a stream, not just the one the player
 * happens to call. A gate in the UI is a suggestion: the manifest URL was in
 * the JSON, so anyone could read it out of the network tab and open it
 * directly, and the sign-in wall would have been decoration.
 *
 * Everything else stays public deliberately. Title, thumbnail, streamer and
 * live state are what a shared link needs to render a preview and what a search
 * engine needs to index the page, and none of it is the broadcast itself.
 */
export function stripPlayback<T extends Pick<Stream, "hlsUrl">>(
  stream: T,
  signedIn: boolean,
): T & { requiresAuth?: true } {
  if (signedIn) return stream;
  return {
    ...stream,
    hlsUrl: "",
    // Explicit, so a client can tell "no video source configured yet" apart
    // from "you are not allowed to see it" and say the right thing.
    requiresAuth: true as const,
  };
}

export function stripPlaybackAll<T extends Pick<Stream, "hlsUrl">>(
  streams: T[],
  signedIn: boolean,
): Array<T & { requiresAuth?: true }> {
  if (signedIn) return streams;
  return streams.map((s) => stripPlayback(s, false));
}
