import type { Ad } from "@/lib/types";
import { apiGet, apiSend } from "./_fetch";

/**
 * Ad serving.
 *
 * `/api/ads/serve` picks one active, in-window ad for a placement, weighted, and
 * wraps it as `{ ad }`. It returns `{ ad: null }` when nothing is booked, which
 * is the normal state until an admin creates one.
 */

export async function pickAd(placement: Ad["placement"]): Promise<Ad | null> {
  const res = await apiGet<{ ad: Ad | null }>("/api/ads/serve", { placement });
  return res?.ad ?? null;
}

/**
 * The mock returned every ad for a placement. The endpoint deliberately serves
 * one at a time so weighting and impression counting stay server-side, so this
 * returns that single pick as a list.
 */
export async function listAds(placement: Ad["placement"]): Promise<Ad[]> {
  const ad = await pickAd(placement);
  return ad ? [ad] : [];
}

/** Fire-and-forget telemetry. A failure here must never break playback. */
export async function recordAdImpression(adId: string): Promise<void> {
  try {
    await apiSend<void>("POST", "/api/ads/impression", { adId });
  } catch {
    // Counting an impression is not worth an error boundary.
  }
}

export async function recordAdClick(adId: string): Promise<void> {
  try {
    await apiSend<void>("POST", "/api/ads/click", { adId });
  } catch {
    // As above.
  }
}
