import { NextResponse, type NextRequest } from "next/server";

import { getShowBySlug, listSeasonsForShow } from "@/lib/api/shows";

export const dynamic = "force-dynamic";

/** GET /api/shows/[slug] - show landing payload (show + seasons rolled up). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  const show = await getShowBySlug(slug);
  if (!show) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const seasons = await listSeasonsForShow(show.id);
  return NextResponse.json(
    { show, seasons },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}
