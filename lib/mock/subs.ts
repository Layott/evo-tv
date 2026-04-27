import type { Subscription } from "@/lib/types";
import { sleep, daysAhead, daysAgo } from "./_util";

export const subscriptions: Subscription[] = [
  {
    id: "sub_1",
    userId: "user_premium",
    tier: "premium",
    status: "active",
    provider: "paystack",
    providerSubId: "sub_paystack_abc123",
    currentPeriodEnd: daysAhead(22),
    priceNgn: 4_500,
    createdAt: daysAgo(30),
  },
];

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  await sleep(80);
  return (
    subscriptions.find((s) => s.userId === userId && s.status === "active") ?? null
  );
}

export async function listSubscriptionsForUser(userId: string): Promise<Subscription[]> {
  await sleep();
  return subscriptions.filter((s) => s.userId === userId);
}

export const tiers = [
  {
    id: "free",
    name: "Free",
    priceNgn: 0,
    tagline: "Watch live + latest VODs with ads",
    features: [
      "All live tournaments",
      "720p playback",
      "Community chat",
      "Ad-supported",
    ],
    cta: "Current plan",
  },
  {
    id: "premium",
    name: "Premium",
    priceNgn: 4_500,
    tagline: "Ad-free, early access, premium film room",
    features: [
      "No ads, anywhere",
      "1080p + HDR playback",
      "Premium film-room analysis streams",
      "Early VOD access (24h)",
      "Exclusive merch discounts",
      "Premium badge in chat",
    ],
    cta: "Upgrade with Paystack",
  },
];
