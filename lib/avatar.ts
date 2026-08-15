/**
 * Avatar resolution, in one place.
 *
 * Profile pictures rendered as black circles for two reasons, and both of them
 * are the kind of thing that only shows up once there are real accounts.
 *
 * 1. An avatar lives in two columns. `user.image` is Better-Auth's, written by
 *    Google sign-in and by the upload route. `profiles.avatar_url` is the one
 *    the edit form writes. Four separate code paths create a `profiles` row
 *    with `avatar_url: ""` when there is nothing to put in it, and the read
 *    used `??`, which only falls through on null. An empty string is not null,
 *    so a Google user with a perfectly good `user.image` resolved to `""` the
 *    moment anything created their profile row.
 *
 * 2. `""` was then handed to `<img src>`. A browser resolves an empty src
 *    against the current document, fetches the page's own HTML, fails to decode
 *    it as an image, and paints nothing. Inside a `rounded-full` box on a dark
 *    ground that is a black disc, which is exactly what was reported.
 *
 * So: treat empty as absent everywhere, and never hand a component an empty
 * string. When there is genuinely no picture, callers render initials instead.
 */

/** First value that is a non-blank string, or null. */
export function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string | null {
  for (const v of values) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

/**
 * The one place that decides which of the two columns wins.
 *
 * `profiles.avatar_url` first, because that is what the edit form and the
 * upload route write and it is the most recent intent. Better-Auth's `image`
 * second, because that is what OAuth populates and it is the only value a user
 * who has never opened the edit form has.
 */
export function resolveAvatarUrl(
  profileAvatarUrl?: string | null,
  userImage?: string | null,
): string | null {
  return firstNonEmpty(profileAvatarUrl, userImage);
}

/**
 * Up to two letters for the fallback. Prefers a real name, so "Ada Lovelace"
 * gives AL rather than the first two letters of an email local-part.
 *
 * Deliberately not `slice(0, 2)` on the whole string: that turns "Ada
 * Lovelace" into "AD", which reads as a word rather than as initials.
 */
export function initialsFrom(
  ...candidates: Array<string | null | undefined>
): string {
  const source = firstNonEmpty(...candidates);
  if (!source) return "?";

  // An email is a handle in disguise. Take the local part so "ada@evotv.co"
  // gives A, not A@.
  const base = source.includes("@") ? source.split("@")[0] : source;

  const words = base
    .split(/[\s._-]+/)
    .map((w) => w.trim())
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) {
    // One word: two letters of it reads better than one lonely letter.
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * A stable surface tint per account, drawn only from the wordmark ramp.
 *
 * Every fallback painted in one flat grey makes a list of users read as a
 * column of identical holes. Varying the tint gives each row something to
 * recognise. The palette is the EVO blue-to-mint ramp and its deep teals only,
 * so this cannot drift into the rainbow of arbitrary hues the owner rejected
 * for category dots.
 */
const TINTS = [
  { bg: "#134a52", fg: "#9ae9df" },
  { bg: "#175f68", fg: "#c9f3ee" },
  { bg: "#1a4a6b", fg: "#a1d6f5" },
  { bg: "#1d5c85", fg: "#cbe8fa" },
  { bg: "#1b7f88", fg: "#eafaf8" },
  { bg: "#163c57", fg: "#74c2ef" },
] as const;

export function avatarTint(seed?: string | null): { bg: string; fg: string } {
  const key = (seed ?? "").trim();
  if (!key) return TINTS[0];
  // djb2. Any stable hash does; this one is short and has no dependencies.
  let h = 5381;
  for (let i = 0; i < key.length; i += 1) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return TINTS[Math.abs(h) % TINTS.length];
}
