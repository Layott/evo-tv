import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/edge/whereami
 *
 * What the edge says about the caller, and nothing else.
 *
 * Sign-in forensics reads Cloudflare's location headers, and whether those
 * headers arrive depends on a switch in somebody's dashboard rather than on
 * anything in this repository. There was no way to answer "is it on yet"
 * without signing in and waiting for a real login to land, which is a slow way
 * to check a toggle.
 *
 * It reports the caller's own location and no one else's, which is information
 * the caller already had. It stores nothing, and it deliberately does not echo
 * the IP: this exists to prove the plumbing, not to become a lookup service.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const h = req.headers;
  const country = h.get("cf-ipcountry");
  const city = h.get("cf-ipcity");
  const region = h.get("cf-region");

  return NextResponse.json(
    {
      // Present on every proxied request, transform or not.
      country: country ?? null,
      // These two need the "Add visitor location headers" managed transform.
      city: city ?? null,
      region: region ?? null,
      continent: h.get("cf-ipcontinent") ?? null,
      timezone: h.get("cf-timezone") ?? null,
      /**
       * The one line worth reading. Country alone means the request reached us
       * through Cloudflare but the transform is off; city means it is on.
       */
      verdict: city
        ? "Visitor location headers are on: sign-ins will record a city."
        : country
          ? "Behind Cloudflare, but the visitor location headers transform is off. Rules > Settings > Managed Transforms."
          : "No Cloudflare headers at all: this request did not come through the proxy.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
