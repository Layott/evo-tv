import type { Ad } from "@/lib/types";
import { sleep, daysAhead, daysAgo } from "./_util";

export const ads: Ad[] = [
  {
    id: "ad_1",
    placement: "home_banner",
    mediaUrl: "/gaming-product-advertisement-banner.jpg",
    clickUrl: "https://example.com/airtel",
    advertiser: "Airtel Nigeria",
    active: true,
    startAt: daysAgo(5),
    endAt: daysAhead(25),
    weight: 100,
    impressions: 48_210,
    clicks: 1_820,
  },
  {
    id: "ad_2",
    placement: "home_banner",
    mediaUrl: "/gaming-mouse.png",
    clickUrl: "https://example.com/infinix",
    advertiser: "Infinix",
    active: true,
    startAt: daysAgo(10),
    endAt: daysAhead(20),
    weight: 80,
    impressions: 62_480,
    clicks: 2_140,
  },
  {
    id: "ad_3",
    placement: "sidebar",
    mediaUrl: "/esports-pro-tips-tutorial.jpg",
    clickUrl: "https://example.com/vent",
    advertiser: "EVO Originals",
    active: true,
    startAt: daysAgo(30),
    endAt: daysAhead(60),
    weight: 50,
    impressions: 12_900,
    clicks: 340,
  },
  {
    id: "ad_4",
    placement: "stream_preroll",
    mediaUrl: "/esports-tournament-recap.jpg",
    clickUrl: "https://paystack.com",
    advertiser: "Paystack",
    active: true,
    startAt: daysAgo(2),
    endAt: daysAhead(28),
    weight: 120,
    impressions: 24_010,
    clicks: 980,
  },
];

export async function listAds(placement: Ad["placement"]): Promise<Ad[]> {
  await sleep(50);
  return ads.filter((a) => a.active && a.placement === placement);
}

export async function pickAd(placement: Ad["placement"]): Promise<Ad | null> {
  await sleep(30);
  const pool = ads.filter((a) => a.active && a.placement === placement);
  if (pool.length === 0) return null;
  const total = pool.reduce((acc, a) => acc + a.weight, 0);
  let r = Math.random() * total;
  for (const a of pool) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return pool[0]!;
}
