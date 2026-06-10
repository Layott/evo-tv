import { NextResponse, type NextRequest } from "next/server";

import { listShows } from "@/lib/api/shows";
import { parseMaxRating, filterByMaxRating } from "@/lib/api/maturity";

export const dynamic = "force-dynamic";

const VALID_PILLARS = ["esports", "anime", "lifestyle"] as const;
const VALID_ORIGINS = ["evo_original", "licensed", "syndicated"] as const;
const VALID_STATUS = ["airing", "completed", "upcoming", "hiatus"] as const;

/** GET /api/originals — list shows, optional pillar/origin/status filters. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const pillar = params.get("pillar");
  const origin = params.get("origin");
  const status = params.get("status");

  const filter: Parameters<typeof listShows>[0] = {};
  if (pillar && (VALID_PILLARS as readonly string[]).includes(pillar)) {
    filter.pillar = pillar as (typeof VALID_PILLARS)[number];
  }
  if (origin && (VALID_ORIGINS as readonly string[]).includes(origin)) {
    filter.originType = origin as (typeof VALID_ORIGINS)[number];
  }
  if (status && (VALID_STATUS as readonly string[]).includes(status)) {
    filter.status = status as (typeof VALID_STATUS)[number];
  }

  const maxRating = parseMaxRating(params.get("maxRating"));
  const shows = filterByMaxRating(await listShows(filter), maxRating);
  return NextResponse.json({ shows });
}
