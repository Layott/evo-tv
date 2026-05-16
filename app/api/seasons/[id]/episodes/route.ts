import { NextResponse, type NextRequest } from "next/server";

import { listEpisodesForSeason } from "@/lib/api/shows";

export const dynamic = "force-dynamic";

/** GET /api/seasons/[id]/episodes — episodes in a single season, ordered. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "invalid_season_id" }, { status: 400 });
  }
  const episodes = await listEpisodesForSeason(id);
  return NextResponse.json(
    { episodes },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=30" } },
  );
}
