import type { MaturityRating } from "@/lib/types";

/**
 * Maturity-rating ranks. Ordered kids<pg<teen<mature so a `maxRating` filter
 * can be expressed as `rank(item) <= rank(maxRating)`.
 */
export const MATURITY_RANK: Record<MaturityRating, number> = {
  kids: 0,
  pg: 1,
  teen: 2,
  mature: 3,
};

/**
 * Parse a `?maxRating=` query param into a MaturityRating, or `undefined` when
 * absent / invalid (meaning: no filtering, return everything).
 */
export function parseMaxRating(
  raw: string | null | undefined,
): MaturityRating | undefined {
  if (raw === "kids" || raw === "pg" || raw === "teen" || raw === "mature") {
    return raw;
  }
  return undefined;
}

/**
 * Filter a list of content items to those at or below `maxRating`. Items with
 * no maturityRating are treated as `teen` (the column default). When `maxRating`
 * is undefined, the input list is returned unchanged.
 */
export function filterByMaxRating<T extends { maturityRating?: MaturityRating }>(
  items: T[],
  maxRating: MaturityRating | undefined,
): T[] {
  if (!maxRating) return items;
  const ceiling = MATURITY_RANK[maxRating];
  return items.filter(
    (item) => MATURITY_RANK[item.maturityRating ?? "teen"] <= ceiling,
  );
}
