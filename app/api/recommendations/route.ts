import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { recommendForUser } from "@/lib/recommendations";
import { trendingVods } from "@/lib/recommendations/trending";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;

  const user = await getCurrentUser();

  if (!user) {
    const items = await trendingVods(limit);
    return NextResponse.json({ items, source: "trending" as const });
  }

  const items = await recommendForUser(user.id, limit);
  if (items.length === 0) {
    const fallback = await trendingVods(limit);
    return NextResponse.json({ items: fallback, source: "trending" as const });
  }
  return NextResponse.json({ items, source: "personalized" as const });
}
