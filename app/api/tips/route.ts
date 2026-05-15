import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { sendTip, TipError } from "@/lib/api/tips";
import { checkIdempotency, recordIdempotency } from "@/lib/http/idempotency";

const bodySchema = z.object({
  toUserId: z.string().min(1).max(128),
  coins: z.number().int().positive(),
  message: z.string().max(280).optional(),
  streamId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const replay = await checkIdempotency(req, user.id);
  if (replay) return replay;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const tip = await sendTip({
      fromUserId: user.id,
      toUserId: parsed.data.toUserId,
      coins: parsed.data.coins,
      message: parsed.data.message,
      streamId: parsed.data.streamId ?? null,
    });
    await recordIdempotency(req, user.id, 200, tip);
    return NextResponse.json(tip);
  } catch (err) {
    if (err instanceof TipError) {
      const status =
        err.code === "user_not_found"
          ? 404
          : err.code === "insufficient_coins"
            ? 402
            : 422;
      const body = { error: err.message, code: err.code };
      await recordIdempotency(req, user.id, status, body);
      return NextResponse.json(body, { status });
    }
    return NextResponse.json({ error: "Tip failed" }, { status: 500 });
  }
}
