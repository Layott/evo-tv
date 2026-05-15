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
  const region =
    [h.get("x-vercel-ip-city"), h.get("x-vercel-ip-country")]
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
