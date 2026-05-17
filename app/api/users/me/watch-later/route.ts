import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { listWatchLater } from "@/lib/api/watch-later";

/**
 * GET /api/users/me/watch-later?limit=50
 *
 * Recent bookmarks for the signed-in user, joined with VOD details
 * (title, thumbnail, duration, gameId, isPremium, pillar). Soft-deleted
 * VODs filtered out. Drives the Watch Later tab on /library.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const raw = Number.parseInt(
    new URL(req.url).searchParams.get("limit") ?? "50",
    10,
  );
  const limit = Math.max(1, Math.min(200, Number.isFinite(raw) ? raw : 50));
  return NextResponse.json(await listWatchLater(user.id, limit));
}
