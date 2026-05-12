import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { placePick, PredictionError } from "@/lib/api/predictions";
import { checkIdempotency, recordIdempotency } from "@/lib/http/idempotency";

const bodySchema = z.object({
  matchId: z.string().min(1).max(128),
  teamPickedId: z.string().min(1).max(128),
  coinsStaked: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const replay = await checkIdempotency(req, user.id);
  if (replay) return replay;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const id = await placePick({
      userId: user.id,
      matchId: parsed.data.matchId,
      teamPickedId: parsed.data.teamPickedId,
      coinsStaked: parsed.data.coinsStaked,
    });
    const body = { id, status: "open" as const };
    await recordIdempotency(req, user.id, 200, body);
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof PredictionError) {
      const status =
        err.code === "match_not_found"
          ? 404
          : err.code === "insufficient_coins"
            ? 402
            : err.code === "duplicate_pick"
              ? 409
              : 422;
      const body = { error: err.message, code: err.code };
      await recordIdempotency(req, user.id, status, body);
      return NextResponse.json(body, { status });
    }
    return NextResponse.json({ error: "Pick failed" }, { status: 500 });
  }
}
