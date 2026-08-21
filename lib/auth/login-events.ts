import "server-only";
import crypto from "node:crypto";
import { headers as nextHeaders } from "next/headers";
import { db, schema } from "@/lib/db";

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
   * Cloudflare always sends the country. City and region arrive only if the
   * "Add visitor location headers" managed transform is switched on, so both
   * are optional and the answer degrades to the country alone.
   *
   * The IP itself stays hashed. City is as precise as this gets on purpose:
   * an exact address is not something a broadcaster needs in order to spot the
   * same person signing in under two names.
   */
  const city = h.get("cf-ipcity") ?? h.get("x-vercel-ip-city");
  const regionName = h.get("cf-region") ?? h.get("x-vercel-ip-country-region");
  const country =
    h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? null;
  const region =
    [city, regionName, country === "XX" ? null : country]
      .filter(Boolean)
      .join(", ") || null;

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
