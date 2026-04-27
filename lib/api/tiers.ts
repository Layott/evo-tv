import "server-only";

export type TierId = "free" | "supporter" | "premium" | "pro";

export interface Tier {
  id: TierId;
  name: string;
  priceNgn: number;
  periodDays: number;
  features: string[];
}

/**
 * Data-driven subscription tiers. Phase 1E only shipped a hardcoded Premium
 * tier; this exposes the full ladder so the UI / checkout can render them.
 */
export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    priceNgn: 0,
    periodDays: 0,
    features: [
      "Watch live streams with ads",
      "Follow teams, players, and streamers",
      "Community chat (rate-limited)",
    ],
  },
  {
    id: "supporter",
    name: "Supporter",
    priceNgn: 1_500,
    periodDays: 30,
    features: [
      "Ad-free home feed",
      "Supporter badge in chat",
      "Early access to VOD drops",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceNgn: 4_500,
    periodDays: 30,
    features: [
      "Everything in Supporter",
      "No pre-roll or mid-roll ads",
      "1080p VOD downloads",
      "Premium-only chat rooms",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceNgn: 12_000,
    periodDays: 30,
    features: [
      "Everything in Premium",
      "Creator analytics dashboard",
      "Priority stream ingest slot",
      "Early API access",
    ],
  },
];

export function listTiers(): Tier[] {
  return TIERS;
}

export function getTier(id: TierId): Tier | null {
  return TIERS.find((t) => t.id === id) ?? null;
}

/**
 * Map a paid amount (NGN) back to the closest tier. Used when processing
 * webhook callbacks that only carry the charged amount.
 */
export function tierOf(priceNgn: number): Tier {
  // Exact match first.
  const exact = TIERS.find((t) => t.priceNgn === priceNgn);
  if (exact) return exact;
  // Otherwise pick the highest paid tier whose price is <= charged amount.
  const paid = TIERS.filter((t) => t.priceNgn > 0 && t.priceNgn <= priceNgn).sort(
    (a, b) => b.priceNgn - a.priceNgn
  );
  return paid[0] ?? TIERS[0]!;
}
