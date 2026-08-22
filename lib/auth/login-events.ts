import "server-only";
import crypto from "node:crypto";
import { headers as nextHeaders } from "next/headers";
import { db, schema } from "@/lib/db";
import { formatLocation, locateIp } from "@/lib/geo/ip-location";

const SALT = process.env.LOGIN_HASH_SALT ?? "evotv-fallback-salt";

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + SALT).digest("hex");
}

/**
 * Write a forensic login_events row. Called from Better-Auth's
 * session.create.after hook. Best-effort: errors are swallowed by the
 * caller so sign-in stays unblocked.
 */
export async function recordLoginEvent(session: { userId: string }): Promise<void> {
  if (!session.userId) return;

  const h = await nextHeaders();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]?.trim() : null;
  const ua = h.get("user-agent");
  const deviceFp = h.get("x-device-id");
  /*
   * Where they signed in from.
   *
   * This read `x-vercel-ip-city` and `x-vercel-ip-country`, which stopped
   * existing the day the platform moved to a droplet behind Cloudflare in
   * August. Every row since has said "Region unknown", not because the
   * information was unavailable but because it was being asked for in the
   * wrong language.
   *
   * Correcting the names was necessary and not sufficient: sign-in goes to
   * BETTER_AUTH_URL, which is api.evotv.co, and that hostname is not proxied.
   * Requests reach the droplet directly, so there are no `cf-*` headers on
   * this request at all and there will not be until the DNS record changes.
   * `locateIp` is what covers that gap, from a local database file and then
   * IPinfo.
   *
   * The address itself stays hashed. City is as precise as this gets on
   * purpose: an exact address is not something a broadcaster needs in order to
   * spot the same person signing in under two names.
   */
  const headerCity = h.get("cf-ipcity");
  const headerRegion = h.get("cf-region");
  const headerCountry = h.get("cf-ipcountry");
  // `remote` is what permits the IPinfo call, and only a sign-in sets it: this
  // row is read by somebody asking where a person signed in from, where a city
  // answers and a country does not.
  const located = headerCity ? null : await locateIp(ip, { remote: true });

  const region =
    formatLocation({
      city: headerCity ?? located?.city ?? null,
      region: headerRegion ?? located?.region ?? null,
      country: headerCountry ?? located?.country ?? null,
    }) ?? null;

  const id = "lg_" + crypto.randomBytes(8).toString("hex");
  const ipHash = ip ? hashIp(ip) : null;

  await db.insert(schema.loginEvents).values({
    id,
    userId: session.userId,
    ipHash,
    region,
    userAgent: ua ?? null,
    deviceFp: deviceFp ?? null,
    method: "session",
    createdAt: new Date().toISOString(),
  });
}
