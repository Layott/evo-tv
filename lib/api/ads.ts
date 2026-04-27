import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Ad } from "@/lib/types";

function toAd(r: typeof schema.ads.$inferSelect): Ad {
  return {
    id: r.id,
    placement: r.placement as Ad["placement"],
    mediaUrl: r.mediaUrl,
    clickUrl: r.clickUrl,
    advertiser: r.advertiser,
    active: r.active,
    startAt: r.startAt,
    endAt: r.endAt,
    weight: r.weight,
    impressions: r.impressions,
    clicks: r.clicks,
  };
}

export async function listAds(placement: Ad["placement"]): Promise<Ad[]> {
  return db
    .select()
    .from(schema.ads)
    .where(and(eq(schema.ads.active, true), eq(schema.ads.placement, placement)))
    .all()
    .map(toAd);
}

export async function pickAd(placement: Ad["placement"]): Promise<Ad | null> {
  const pool = await listAds(placement);
  if (pool.length === 0) return null;
  const total = pool.reduce((acc, a) => acc + a.weight, 0);
  let r = Math.random() * total;
  for (const a of pool) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return pool[0]!;
}
