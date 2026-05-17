import { NextResponse, type NextRequest } from "next/server";
import { getVodById } from "@/lib/api/vods";

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
  const vod = await getVodById(id);
  if (!vod) return new NextResponse("VOD not found", { status: 404 });
  return NextResponse.json(vod);
}
