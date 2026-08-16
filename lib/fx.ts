import "server-only";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Prices are set in naira and shown in the viewer's own money.
 *
 * Two things this deliberately is not:
 *
 * - It is **not** multi-currency billing. Whatever the viewer is shown, the
 *   charge is in NGN, so every converted figure is marked as approximate.
 *   Showing "$2.10" and taking ₦3,000 without saying so is how you earn
 *   chargebacks.
 * - It is **not** a location service. The country comes from the edge header
 *   the CDN already attaches, which is a country and nothing finer.
 *
 * Rates are cached for a day in the `feature_flags` row `fx.rates`, so the
 * upstream is called once per day per deployment rather than once per page.
 */

export const FX_FLAG_KEY = "fx.rates";
export const BASE_CURRENCY = "NGN";

/** A day. Consumer prices do not move fast enough to need better. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Countries to the currency people there actually price in.
 *
 * Deliberately short. A viewer in a country not on this list sees dollars,
 * which is the honest default for "somewhere we have not thought about yet",
 * and a viewer in Nigeria sees naira with no conversion at all.
 */
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  EG: "EGP",
  MA: "MAD",
  CI: "XOF",
  SN: "XOF",
  CM: "XAF",
  GB: "GBP",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  PT: "EUR",
  US: "USD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  AE: "AED",
  SA: "SAR",
  IN: "INR",
  BR: "BRL",
};

/**
 * Unknown country means naira, not dollars.
 *
 * The header is absent whenever the hostname is not proxied by the CDN, which
 * is most of the time today, and the largest group of visitors is Nigerian.
 * Defaulting to dollars would show the home audience a foreign currency for a
 * price that is charged in their own.
 */
export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return BASE_CURRENCY;
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? "USD";
}

/**
 * The country the CDN says the request came from.
 *
 * Cloudflare attaches `cf-ipcountry` to every proxied request, which costs
 * nothing and means no IP lookup of our own. When the hostname is not proxied
 * the header is absent and everyone sees naira, which is a fine failure.
 */
export function countryFromHeaders(headers: Headers): string | null {
  const cf = headers.get("cf-ipcountry");
  if (cf && cf !== "XX" && cf.length === 2) return cf.toUpperCase();
  const vercel = headers.get("x-vercel-ip-country");
  if (vercel && vercel.length === 2) return vercel.toUpperCase();
  return null;
}

interface RateCache {
  fetchedAt: string;
  /** How many units of the key currency one naira buys. */
  rates: Record<string, number>;
}

async function readCache(): Promise<RateCache | null> {
  const row = (
    await db
      .select({ payload: schema.featureFlags.payload })
      .from(schema.featureFlags)
      .where(eq(schema.featureFlags.key, FX_FLAG_KEY))
      .limit(1)
  )[0];
  const p = row?.payload as Partial<RateCache> | undefined;
  if (!p?.fetchedAt || !p.rates || typeof p.rates !== "object") return null;
  return { fetchedAt: p.fetchedAt, rates: p.rates as Record<string, number> };
}

async function writeCache(cache: RateCache): Promise<void> {
  const payload = cache as unknown as Record<string, unknown>;
  await db
    .insert(schema.featureFlags)
    .values({
      key: FX_FLAG_KEY,
      enabled: true,
      description: "Cached NGN exchange rates for display-only conversion",
      payload,
    })
    .onConflictDoUpdate({
      target: schema.featureFlags.key,
      set: { payload, enabled: true },
    });
}

/**
 * Fresh rates, or the stale ones, or nothing.
 *
 * A stale rate is better than no price: the figure is approximate anyway, and
 * a viewer seeing yesterday's conversion is in a better position than a viewer
 * seeing a currency they do not use.
 */
export async function getRates(): Promise<RateCache | null> {
  const cached = await readCache().catch(() => null);
  const fresh =
    cached && Date.now() - new Date(cached.fetchedAt).getTime() < MAX_AGE_MS;
  if (fresh) return cached;

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`, {
      // The route caches this itself; Next should not also hold a copy.
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (body.result === "success" && body.rates) {
        const next: RateCache = {
          fetchedAt: new Date().toISOString(),
          rates: body.rates,
        };
        await writeCache(next).catch(() => {});
        return next;
      }
    }
  } catch {
    /* fall through to whatever is cached */
  }
  return cached;
}

export interface DisplayPrice {
  currency: string;
  /** Multiply a naira figure by this to get the display figure. */
  rate: number;
  /** True when no conversion is happening, so callers can drop the "about". */
  isBase: boolean;
  fetchedAt: string | null;
}

export async function displayPriceFor(country: string | null): Promise<DisplayPrice> {
  const currency = currencyForCountry(country);
  if (currency === BASE_CURRENCY) {
    return { currency, rate: 1, isBase: true, fetchedAt: null };
  }
  const cache = await getRates();
  const rate = cache?.rates?.[currency];
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    // No usable rate: show naira rather than a wrong number.
    return { currency: BASE_CURRENCY, rate: 1, isBase: true, fetchedAt: null };
  }
  return { currency, rate, isBase: false, fetchedAt: cache?.fetchedAt ?? null };
}
