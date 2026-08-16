import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { listShows } from "@/lib/api/shows";

export const dynamic = "force-dynamic";

/**
 * GET /api/shows - the catalogue.
 *
 * `/api/shows/[slug]` has existed since the shows CMS shipped, so a viewer
 * could open a show they already had the address of and had no way to find one.
 * This is the list behind `/shows`.
 */

const querySchema = z.object({
  pillar: z.enum(["esports", "anime", "lifestyle"]).optional(),
  originType: z.enum(["evo_original", "licensed", "syndicated"]).optional(),
  status: z.enum(["airing", "completed", "upcoming", "hiatus"]).optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const shows = await listShows(parsed.data);
  return NextResponse.json(
    { shows },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}
