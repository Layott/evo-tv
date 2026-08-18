import { NextResponse, type NextRequest } from "next/server";
import { getVodBySlugOrId } from "@/lib/api/vods";
import { resolveViewer, stripVodPlayback } from "@/lib/api/playback";
import { stripViewCount } from "@/lib/api/counts";

/**
 * GET /api/vods/[id]
 *
 * Public VOD detail, minus the video itself for anyone not entitled to it.
 * Filters out soft-deleted rows (deletedAt IS NULL via the lib function).
 * Returns 404 if the VOD does not exist or is soft-deleted.
 *
 * The playback URLs used to be in this response unconditionally, so the premium
 * wall was a modal in the browser and could be walked around from the network
 * tab.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Accepts either form, because the page can now be reached by slug.
  const vod = await getVodBySlugOrId(id);
  if (!vod) return new NextResponse("VOD not found", { status: 404 });
  const viewer = await resolveViewer();
  return NextResponse.json(
    stripViewCount(stripVodPlayback(vod, viewer), viewer.admin),
  );
}
