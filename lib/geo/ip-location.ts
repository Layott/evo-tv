import "server-only";

/**
 * Where an address is, asked of three sources in order of what each costs.
 *
 * The platform sits behind Cloudflare on evotv.co and *not* on api.evotv.co,
 * which resolves straight to the droplet. Sign-ins and every app request go to
 * api, so they arrive carrying no `cf-*` headers at all, which is why every
 * login row read "Region unknown" even after the header names were corrected.
 * Cloudflare cannot be the only answer while that is true.
 *
 * So there are three, tried cheapest first:
 *
 *   1. Cloudflare's headers, when the request came through the proxy. Free,
 *      already on the request, no lookup.
 *   2. A local database file, a few microseconds and no network. Covers the
 *      requests Cloudflare never saw.
 *   3. IPinfo, one HTTPS call, for the addresses the local file places in a
 *      country but not a city. Rare once the cache is warm.
 *
 * Each step is optional. With no database file and no token the module returns
 * null and callers degrade to whatever the headers gave them, which is what
 * happened before any of this existed.
 *
 * The address is never stored. It is resolved to a place, and the caller keeps
 * the place and a salted hash. City is the deliberate ceiling.
 */

export type IpLocation = {
  city: string | null;
  region: string | null;
  country: string | null;
  /** Which of the three answered. Shown on the diagnostic route, not stored. */
  source: "local" | "ipinfo";
};

const DB_PATH = process.env.GEOIP_DB_PATH ?? "/srv/evotv/geoip/city.mmdb";
const IPINFO_TOKEN = process.env.IPINFO_TOKEN ?? "";

/** A lookup is worth waiting for, but never worth holding up a sign-in. */
const IPINFO_TIMEOUT_MS = 1_500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 5_000;

type CacheEntry = { at: number; value: IpLocation | null };
const cache = new Map<string, CacheEntry>();

function cacheGet(ip: string): CacheEntry | undefined {
  const hit = cache.get(ip);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(ip);
    return undefined;
  }
  return hit;
}

function cacheSet(ip: string, value: IpLocation | null): void {
  // Oldest out first. Insertion order is Map's iteration order, and an entry
  // that is re-read is not re-inserted, so this is age rather than use. For a
  // table this small the difference does not pay for the bookkeeping.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(ip, { at: Date.now(), value });
}

/**
 * Addresses no lookup can place: loopback, link-local, and the private ranges.
 *
 * These arrive in development and from anything inside the compose network, and
 * asking a paid API about 172.18.0.4 spends a request to be told nothing.
 */
function isPrivate(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.") || ip.startsWith("fe80:")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // unique local v6
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ local */

type CityReader = {
  city: (ip: string) => {
    city?: { names?: Record<string, string> };
    subdivisions?: Array<{ names?: Record<string, string> }>;
    country?: { isoCode?: string };
  };
};

let readerPromise: Promise<CityReader | null> | null = null;

/**
 * Open the database once and hold it.
 *
 * A missing file is the normal state in development and on any box where the
 * download has not run, so it is reported once and then never again: a line per
 * request would bury the log for a condition that will not change until
 * somebody puts a file there.
 */
function openReader(): Promise<CityReader | null> {
  readerPromise ??= (async () => {
    try {
      const fs = await import("node:fs/promises");
      const buffer = await fs.readFile(DB_PATH);
      const { Reader } = await import("@maxmind/geoip2-node");
      return Reader.openBuffer(buffer) as unknown as CityReader;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        console.warn(
          `[geo] no local database at ${DB_PATH}; falling back to IPinfo. Run deploy/geoip-refresh.sh to add one.`,
        );
      } else {
        console.warn("[geo] local database unreadable:", err);
      }
      return null;
    }
  })();
  return readerPromise;
}

/** Pick a name in English, then whatever the file has, then nothing. */
function pickName(names: Record<string, string> | undefined): string | null {
  if (!names) return null;
  return names.en ?? Object.values(names)[0] ?? null;
}

async function fromLocal(ip: string): Promise<IpLocation | null> {
  const reader = await openReader();
  if (!reader) return null;
  try {
    const found = reader.city(ip);
    const city = pickName(found.city?.names);
    const region = pickName(found.subdivisions?.[0]?.names);
    const country = found.country?.isoCode ?? null;
    if (!city && !region && !country) return null;
    return { city, region, country, source: "local" };
  } catch {
    // The reader throws for an address it does not hold, which is an answer of
    // "not in the file" rather than a failure.
    return null;
  }
}

/* ----------------------------------------------------------------- ipinfo */

type IpinfoResponse = {
  city?: string;
  region?: string;
  country?: string;
  bogon?: boolean;
};

async function fromIpinfo(ip: string): Promise<IpLocation | null> {
  if (!IPINFO_TOKEN) return null;
  try {
    const res = await fetch(
      `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(IPINFO_TOKEN)}`,
      {
        signal: AbortSignal.timeout(IPINFO_TIMEOUT_MS),
        headers: { accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      // 429 is the free tier's monthly ceiling. Worth a line, not a throw.
      console.warn(`[geo] ipinfo ${res.status} for a lookup`);
      return null;
    }
    const body = (await res.json()) as IpinfoResponse;
    if (body.bogon) return null;
    const city = body.city?.trim() || null;
    const region = body.region?.trim() || null;
    const country = body.country?.trim().toUpperCase() || null;
    if (!city && !region && !country) return null;
    return { city, region, country, source: "ipinfo" };
  } catch {
    // A timeout or a DNS failure must not fail whatever asked. No location is
    // an acceptable outcome; a failed sign-in is not.
    return null;
  }
}

/* ------------------------------------------------------------------- api  */

/**
 * Locate an address, or return null.
 *
 * Never throws. Callers treat the result as decoration on a row they were
 * writing anyway.
 */
export async function locateIp(ip: string | null | undefined): Promise<IpLocation | null> {
  if (!ip || isPrivate(ip)) return null;

  const cached = cacheGet(ip);
  if (cached) return cached.value;

  const local = await fromLocal(ip);
  // The local file places most addresses in a country and many in a city. Only
  // the ones it leaves without a city are worth an HTTPS call, which keeps the
  // free tier's monthly allowance spent on the addresses that need it.
  const value = local?.city ? local : ((await fromIpinfo(ip)) ?? local);

  cacheSet(ip, value);
  return value;
}

/** "Lagos, Lagos, NG", skipping whatever is missing. Null when all of it is. */
export function formatLocation(
  parts: { city?: string | null; region?: string | null; country?: string | null } | null,
): string | null {
  if (!parts) return null;
  const country = parts.country === "XX" ? null : parts.country;
  return [parts.city, parts.region, country].filter(Boolean).join(", ") || null;
}

/** For the diagnostic route: which sources are configured on this box. */
export function geoConfig(): { dbPath: string; ipinfo: boolean } {
  return { dbPath: DB_PATH, ipinfo: Boolean(IPINFO_TOKEN) };
}
