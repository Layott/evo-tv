import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLocation } from "@/lib/geo/ip-location";

/**
 * The lookup chain, at the two points where it can quietly cost money or
 * quietly return nothing.
 *
 * The module holds a cache and a database handle in module scope, so each test
 * that exercises `locateIp` imports it fresh rather than sharing state with the
 * one before it.
 */

async function freshModule(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@/lib/geo/ip-location");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("formatLocation", () => {
  it("joins what it has and skips what it does not", () => {
    expect(formatLocation({ city: "Lagos", region: "Lagos", country: "NG" })).toBe(
      "Lagos, Lagos, NG",
    );
    expect(formatLocation({ city: null, region: null, country: "NG" })).toBe("NG");
  });

  it("drops XX, which is Cloudflare for 'no idea'", () => {
    // A row reading "XX" looks like a place to anybody scanning the log.
    expect(formatLocation({ city: null, region: null, country: "XX" })).toBeNull();
  });

  it("is null rather than an empty string when nothing is known", () => {
    expect(formatLocation({ city: null, region: null, country: null })).toBeNull();
    expect(formatLocation(null)).toBeNull();
  });
});

describe("locateIp", () => {
  it("never asks a paid API about an address on the compose network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { locateIp } = await freshModule({
      IPINFO_TOKEN: "test-token",
      GEOIP_DB_PATH: "/nonexistent/city.mmdb",
    });

    for (const ip of ["127.0.0.1", "10.0.0.4", "172.18.0.9", "192.168.1.5", "::1"]) {
      expect(await locateIp(ip)).toBeNull();
    }
    expect(await locateIp(null)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls through to IPinfo when there is no local database, once per address", async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({ city: "Lagos", region: "Lagos", country: "NG" }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { locateIp } = await freshModule({
      IPINFO_TOKEN: "test-token",
      GEOIP_DB_PATH: "/nonexistent/city.mmdb",
    });

    expect(await locateIp("105.112.0.1")).toEqual({
      city: "Lagos",
      region: "Lagos",
      country: "NG",
      source: "ipinfo",
    });

    // A viewer sends a heartbeat every fifteen seconds. Without the cache that
    // is one paid lookup per heartbeat, and the free tier is a monthly count.
    await locateIp("105.112.0.1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null instead of throwing when IPinfo is slow or broken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const { locateIp } = await freshModule({
      IPINFO_TOKEN: "test-token",
      GEOIP_DB_PATH: "/nonexistent/city.mmdb",
    });

    // The caller is writing a login row. No location is acceptable; a thrown
    // error inside a sign-in is not.
    expect(await locateIp("105.112.0.1")).toBeNull();
  });

  it("does not call out at all when no token is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { locateIp } = await freshModule({
      IPINFO_TOKEN: undefined,
      GEOIP_DB_PATH: "/nonexistent/city.mmdb",
    });

    expect(await locateIp("105.112.0.1")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
