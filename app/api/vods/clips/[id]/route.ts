import { NextResponse, type NextRequest } from "next/server";
import { getClipById } from "@/lib/api/vods";

/**
 * GET /api/vods/clips/[id]
 *
 * Public clip detail. Lib filters soft-deleted (deletedAt IS NULL).
 * 404 when missing.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clip = await getClipById(id);
  if (!clip) return new NextResponse("Clip not found", { status: 404 });
  return NextResponse.json(clip);
}
