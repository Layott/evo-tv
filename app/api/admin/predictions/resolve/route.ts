import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { resolveMatch } from "@/lib/api/predictions";
import { writeAudit } from "@/lib/api/audit";

const bodySchema = z.object({
  matchId: z.string().min(1).max(128),
  winningTeamId: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await resolveMatch(parsed.data.matchId, parsed.data.winningTeamId);
  void writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "event",
    targetId: parsed.data.matchId,
    meta: { event: "prediction_resolved", winningTeamId: parsed.data.winningTeamId, ...result },
  });

  return NextResponse.json(result);
}
