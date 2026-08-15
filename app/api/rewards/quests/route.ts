import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { listDailyQuests } from "@/lib/api/rewards";

export const dynamic = "force-dynamic";

/**
 * GET /api/rewards/quests - daily quests for the current user.
 *
 * Returns the 6 templated daily quests with live progress (computed from
 * watchEvents / likes / tips / predictions / xp_events) and per-quest claimed
 * state for today (UTC).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  return NextResponse.json(await listDailyQuests(user.id));
}
