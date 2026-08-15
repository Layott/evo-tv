import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { claimDailyQuest, QuestClaimError } from "@/lib/api/rewards";

export const dynamic = "force-dynamic";

/**
 * POST /api/rewards/quests/[id]/claim - claim a completed daily quest.
 *
 * Validates that progress meets the target and the quest hasn't already been
 * claimed today (per UTC day). Grants coins + XP atomically and inserts the
 * `daily_quest_claims` marker. Returns the updated balance for client
 * optimistic UI.
 *
 * Errors: 404 unknown quest, 409 already claimed, 422 incomplete.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "invalid_quest" }, { status: 400 });

  try {
    const result = await claimDailyQuest(user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QuestClaimError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "already_claimed"
            ? 409
            : 422;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }
}
