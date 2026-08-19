/**
 * Is this URL a video or a still?
 *
 * Ads are stored as a bare `mediaUrl` with nothing recording what kind of file
 * it is, and two surfaces need to know: the ads form, which must not let a JPEG
 * be saved for a placement that plays in the player, and the break player,
 * which has to render a still in an `<img>` rather than hand it to a `<video>`
 * tag that will only fail.
 *
 * The extension is what there is to go on. It is enough here because every
 * creative is uploaded through the CMS, which keeps the extension, and a URL
 * that carries no extension is treated as a still: the still path degrades to a
 * broken image, and the video path degrades to a break that ends immediately
 * and drops the viewer back onto a feed that is not there.
 */
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "m3u8"];

export function looksLikeVideo(url: string): boolean {
  if (!url) return false;
  const path = url.split(/[?#]/)[0] ?? "";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.includes(ext);
}
