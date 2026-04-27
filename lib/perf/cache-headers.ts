/**
 * Cache-Control helpers for HLS delivery out of /api/uploads/*.
 *
 * - `.ts` segments are content-addressed and immutable — cache for an hour.
 * - `.m3u8` playlists change every few seconds for live — cache briefly.
 *
 * Consumers in the uploads route can choose which to apply based on the
 * requested file extension.
 */
export type HeaderMap = Record<string, string>;

export function hlsSegmentHeaders(pathOrExt?: string): HeaderMap {
  if (!pathOrExt) {
    return { "Cache-Control": "public, max-age=3600, immutable" };
  }
  const lower = pathOrExt.toLowerCase();
  if (lower.endsWith(".m3u8")) {
    return { "Cache-Control": "public, max-age=5" };
  }
  if (lower.endsWith(".ts")) {
    return { "Cache-Control": "public, max-age=3600, immutable" };
  }
  // Default to segment-style headers for unknown extensions.
  return { "Cache-Control": "public, max-age=3600, immutable" };
}
