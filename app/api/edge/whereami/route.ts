import { NextResponse, type NextRequest } from "next/server";
import { geoConfig, locateIp } from "@/lib/geo/ip-location";

/**
 * GET /api/edge/whereami
 *
 * What each location source says about the caller, and nothing else.
 *
 * Sign-in forensics has three sources and every one of them depends on
 * something outside this repository: a switch in a Cloudflare dashboard, a
 * database file on the box, an API token in an env file. There was no way to
 * answer "is it working yet" without signing in and waiting for a real login
 * row to land, which is a slow way to check a toggle.
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

  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const located = await locateIp(ip);
  const config = geoConfig();

  const cloudflare = city
    ? "on, with city"
    : country
      ? "proxied, but the visitor location transform is off"
      : "not proxied: this request did not pass through Cloudflare";

  const lookup = located
    ? `${located.source} answered ${[located.city, located.region, located.country].filter(Boolean).join(", ")}`
    : config.dbPath || config.ipinfo
      ? "no source could place this address"
      : "nothing configured";

  return NextResponse.json(
    {
      cloudflare: {
        country: country ?? null,
        city: city ?? null,
        region: region ?? null,
        continent: h.get("cf-ipcontinent") ?? null,
        timezone: h.get("cf-timezone") ?? null,
      },
      lookup: located,
      configured: {
        localDatabase: config.dbPath,
        ipinfoToken: config.ipinfo,
      },
      /**
       * The one line worth reading. A sign-in records a location if either half
       * of this sentence found one, so Cloudflare being off is survivable.
       */
      verdict: `Cloudflare: ${cloudflare}. Lookup: ${lookup}.`,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
