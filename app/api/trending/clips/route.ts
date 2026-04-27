import { NextResponse, type NextRequest } from "next/server";
import { listTrendingClips } from "@/lib/api/trending";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("limit");
  const parsed = raw == null ? 10 : Number(raw);
  const limit =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(100, Math.floor(parsed)) : 10;
  const clips = await listTrendingClips(limit);
  return NextResponse.json({ clips });
}
