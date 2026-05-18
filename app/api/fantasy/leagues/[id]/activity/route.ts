import { NextResponse, type NextRequest } from "next/server";
import { listActivity } from "@/lib/api/fantasy";

/** GET /api/fantasy/leagues/[id]/activity?limit=20 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const raw = Number.parseInt(
    new URL(req.url).searchParams.get("limit") ?? "20",
    10,
  );
  const limit = Math.max(1, Math.min(100, Number.isFinite(raw) ? raw : 20));
  return NextResponse.json(await listActivity(id, limit));
}
