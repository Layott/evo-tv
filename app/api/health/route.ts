import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Liveness + readiness probe.
 *
 * Used by the deploy script (waits for 200 before declaring a release good),
 * by DO uptime monitoring, and by the cutover smoke test in
 * docs/DIGITALOCEAN_MIGRATION.md.
 *
 * Returns 503 when the database is unreachable so a broken release is caught
 * before it takes traffic. Error detail goes to the log, never to the caller.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up" });
  } catch (err) {
    log.error({ err }, "health check failed: db unreachable");
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
