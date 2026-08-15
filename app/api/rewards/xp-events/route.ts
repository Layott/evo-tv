import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { listRecentXpEvents } from "@/lib/api/rewards";

export const dynamic = "force-dynamic";

/**
 * GET /api/rewards/xp-events?limit=20 - recent XP grants for the current user.
 *
 * Used to render the activity timeline on the rewards screen ("+80 XP · Watch
 * 30 minutes · 2h ago"). Limit clamped to 50.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const raw = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Math.max(1, Math.min(50, Number.isFinite(raw) ? raw : 20));
  return NextResponse.json(await listRecentXpEvents(user.id, limit));
}
