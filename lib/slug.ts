/**
 * Turning a title into the thing that goes in a URL.
 *
 * The rule is deliberately dull: lowercase, anything that is not a letter or a
 * digit becomes a hyphen, runs collapse, ends trimmed. Dull matters because the
 * same transformation is written twice, once here and once in SQL in
 * `db/migrations/0035_content_slugs.sql`, and the two have to agree or a row
 * backfilled by the migration gets a different URL from one created by the app.
 *
 * Accents are stripped rather than encoded, so "Otaku & Chillz" and
 * "Otáku & Chillz" do not become two different-looking URLs for the same idea.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    // Combining marks left behind by the decomposition above.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * A slug that is free, given a way to ask whether one is taken.
 *
 * Collides by appending a short suffix rather than a counter, because a counter
 * needs a read of every neighbour and still races two concurrent inserts. The
 * unique constraint on the column is what actually guarantees this; the loop
 * only keeps the common case pretty.
 *
 * `suffix` is injected so a caller can pass the row id it is about to use,
 * which makes the result reproducible in a test.
 */
export async function uniqueSlug(
  title: string,
  isTaken: (candidate: string) => Promise<boolean>,
  suffix: () => string,
): Promise<string> {
  const base = slugify(title);
  // An all-punctuation title slugifies to nothing. Fall back to the suffix
  // alone rather than writing an empty string into a unique column.
  if (!base) return suffix();
  if (!(await isTaken(base))) return base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${suffix()}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Five collisions on a random suffix means something is wrong with the
  // suffix, not with the title. Let the unique constraint be the last word.
  return `${base}-${suffix()}`;
}

/** Short, URL-safe, and not sequential, so it leaks nothing about volume. */
export function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Whether a path segment is one of our ids rather than a slug.
 *
 * Ids are `<prefix>_<hex>` (`stream_f94d2c...`, `vod_5af904...`), and a slug
 * never contains an underscore because `slugify` turns one into a hyphen. That
 * is what lets one route serve both and redirect the id form to the slug.
 */
export function looksLikeId(segment: string): boolean {
  return segment.includes("_");
}
