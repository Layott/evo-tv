import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest, writeAudit } from "@/lib/api/admin";
import { scorePickemForEvent } from "@/lib/pickem/score";

/**
 * POST /api/admin/pickem/[eventId]/score - admin only.
 *
 * Idempotent - walks completed matches for the event, recomputes
 * pickem_entries.score for every entry, returns counts.
 *
 * Wire this into the admin matches-result UI: after marking a match
 * completed, hit this route to recompute leaderboard.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { eventId } = await params;
  const result = await scorePickemForEvent(eventId);

  void writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "event",
    targetId: eventId,
    meta: {
      event: "pickem_score",
      matchesScored: result.matchesScored,
      entriesUpdated: result.entriesUpdated,
    },
  });

  return NextResponse.json(result);
}
