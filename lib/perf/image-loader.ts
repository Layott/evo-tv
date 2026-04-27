/**
 * Custom next/image loader for assets served under /api/uploads/*.
 *
 * Appends `?w=<width>&q=<quality>` so a downstream image transformer
 * (or edge cache) can serve appropriately-sized variants.
 *
 * Not yet wired into next.config.mjs; import and pass via the `loader`
 * prop on an <Image> when you want to opt a specific surface in.
 */
export interface ImageLoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

export default function imageLoader({
  src,
  width,
  quality,
}: ImageLoaderArgs): string {
  const q = quality ?? 75;
  const sep = src.includes("?") ? "&" : "?";
  return `${src}${sep}w=${width}&q=${q}`;
}
