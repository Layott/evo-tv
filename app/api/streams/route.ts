import { NextResponse, type NextRequest } from "next/server";
import { listLiveStreams, listFeaturedStreams } from "@/lib/api/streams";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const featured = searchParams.get("featured") === "1";
  if (featured) return NextResponse.json(await listFeaturedStreams());

  const gameId = searchParams.get("gameId") ?? undefined;
  const premiumStr = searchParams.get("isPremium");
  const isPremium = premiumStr === null ? undefined : premiumStr === "true";
  return NextResponse.json(await listLiveStreams({ gameId, isPremium }));
}
