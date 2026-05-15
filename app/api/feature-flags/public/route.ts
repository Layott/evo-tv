import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * GET /api/feature-flags/public
 *
 * Returns ONLY the flags safe to expose to anonymous clients. Used by the RN
 * client to render the maintenance / takedown banner without needing auth.
 */
const PUBLIC_FLAGS = ["maintenance.enabled", "takedown.enabled"] as const;

export async function GET() {
  const rows = await db
    .select()
    .from(schema.featureFlags)
    .where(
      inArray(schema.featureFlags.key, PUBLIC_FLAGS as unknown as string[]),
    );

  const out: Record<string, { enabled: boolean; message?: string }> = {};
  for (const r of rows) {
    out[r.key] = {
      enabled: r.enabled,
      message:
        r.payload && typeof (r.payload as Record<string, unknown>).message === "string"
          ? ((r.payload as Record<string, unknown>).message as string)
          : undefined,
    };
  }

  return NextResponse.json(out, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
  });
}
