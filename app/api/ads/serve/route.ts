import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const querySchema = z.object({
  placement: z
    .enum(["home_banner", "stream_preroll", "sidebar", "between_content"])
    .default("home_banner"),
});

/**
 * GET /api/ads/serve?placement=<slot>
 *
 * Returns ONE active, in-window ad for the requested placement. Weights
 * bias selection toward higher-weight rows. Public - no auth.
 *
 * Round-trip with the admin ads-manager: admin creates / activates a row,
 * this endpoint surfaces it on the client, and /api/ads/impression bumps
 * `impressions`. Click goes through /api/ads/click then redirects.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const nowIso = new Date().toISOString();
  const rows = await db
    .select()
    .from(schema.ads)
    .where(
      and(
        eq(schema.ads.placement, parsed.data.placement),
        eq(schema.ads.active, true),
        lte(schema.ads.startAt, nowIso),
        gte(schema.ads.endAt, nowIso),
      ),
    );

  if (rows.length === 0) {
    return NextResponse.json(
      { ad: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Weighted random selection.
  const totalWeight = rows.reduce((acc, r) => acc + Math.max(1, r.weight), 0);
  let pick = Math.random() * totalWeight;
  let chosen = rows[0];
  for (const r of rows) {
    pick -= Math.max(1, r.weight);
    if (pick <= 0) {
      chosen = r;
      break;
    }
  }

  return NextResponse.json(
    { ad: chosen },
    { headers: { "Cache-Control": "no-store" } },
  );
}
