import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { countryFromHeaders, displayPriceFor, BASE_CURRENCY } from "@/lib/fx";

/**
 * GET /api/fx?country=GB
 *
 * What currency to show this visitor, and the rate to show it at.
 *
 * Two ways to say where the viewer is, in order of trust:
 *
 * 1. **An explicit `country`**, which the phone app sends from the device's own
 *    locale. That is what the person actually set on their phone, so it beats a
 *    guess made from an IP address, and it keeps working through a VPN, on
 *    roaming, and when the hostname is not behind a CDN.
 * 2. **The CDN's country header**, for the website, where there is no app to
 *    ask and the header is already on the request.
 *
 * Neither is authoritative for anything that matters: the figure is display
 * only and the charge is in naira, so a wrong guess costs a wrong label rather
 * than a wrong amount. That is why an unverified query parameter is acceptable
 * here and would not be on a checkout.
 */

const querySchema = z.object({
  country: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  // A malformed country is ignored rather than rejected: the page still needs a
  // price, and the header or naira is a perfectly good answer.
  const asked = parsed.success ? parsed.data.country : undefined;

  const country = asked?.toUpperCase() ?? countryFromHeaders(req.headers);
  const price = await displayPriceFor(country);

  return NextResponse.json(
    {
      base: BASE_CURRENCY,
      currency: price.currency,
      rate: price.rate,
      isBase: price.isBase,
      fetchedAt: price.fetchedAt,
      country,
      source: asked ? "device" : country ? "edge" : "default",
    },
    {
      headers: {
        // Per-country and short-lived, so a shared cache cannot pin a viewer to
        // somebody else's currency.
        "Cache-Control": "private, max-age=300",
        Vary: "cf-ipcountry",
      },
    },
  );
}
