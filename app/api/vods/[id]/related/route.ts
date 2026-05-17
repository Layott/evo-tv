import { NextResponse, type NextRequest } from "next/server";
import { listRelatedVods } from "@/lib/api/vods";

/**
 * GET /api/vods/[id]/related?limit=6
 *
 * Public list of VODs related to [id] (same gameId, excluding self). If the
 * source VOD doesn't exist, falls back to a generic recent list inside the
 * lib helper.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const raw = Number.parseInt(
    new URL(req.url).searchParams.get("limit") ?? "6",
    10,
  );
  const limit = Math.max(1, Math.min(50, Number.isFinite(raw) ? raw : 6));
  return NextResponse.json(await listRelatedVods(id, limit));
}
