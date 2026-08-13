import { NextResponse, type NextRequest } from "next/server";
import { getVodBySlugOrId } from "@/lib/api/vods";

/**
 * GET /api/vods/[id]
 *
 * Public VOD detail. Filters out soft-deleted rows (deletedAt IS NULL via the
 * lib function). Returns 404 if the VOD does not exist or is soft-deleted.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Accepts either form, because the page can now be reached by slug.
  const vod = await getVodBySlugOrId(id);
  if (!vod) return new NextResponse("VOD not found", { status: 404 });
  return NextResponse.json(vod);
}
