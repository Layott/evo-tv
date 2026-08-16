import { NextResponse, type NextRequest } from "next/server";

import { countryFromHeaders, displayPriceFor, BASE_CURRENCY } from "@/lib/fx";

/**
 * GET /api/fx
 *
 * What currency to show this visitor, and the rate to show it at. Public, and
 * deliberately cheap: the rate itself is cached for a day server-side, so this
 * is a database read at worst.
 *
 * The country is read from the CDN's own header. Nothing here looks up an IP,
 * and the response carries no address.
 */
export async function GET(req: NextRequest) {
  const country = countryFromHeaders(req.headers);
  const price = await displayPriceFor(country);

  return NextResponse.json(
    {
      base: BASE_CURRENCY,
      currency: price.currency,
      rate: price.rate,
      isBase: price.isBase,
      fetchedAt: price.fetchedAt,
      country,
    },
    {
      headers: {
        // Per-country, and only for a few minutes: a viewer should not be
        // pinned to a stale currency by a shared cache.
        "Cache-Control": "private, max-age=300",
        Vary: "cf-ipcountry",
      },
    },
  );
}
