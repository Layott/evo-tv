import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { redeemDrop, RedeemError } from "@/lib/api/rewards";
import { checkIdempotency, recordIdempotency } from "@/lib/http/idempotency";

const bodySchema = z.object({
  dropId: z.string().min(1),
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
    const redemption = await redeemDrop(user.id, parsed.data.dropId);
    await recordIdempotency(req, user.id, 200, redemption);
    return NextResponse.json(redemption);
  } catch (err) {
    if (err instanceof RedeemError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "insufficient_coins"
            ? 402
            : err.code === "out_of_stock"
              ? 409
              : 410;
      const body = { error: err.message, code: err.code };
      await recordIdempotency(req, user.id, status, body);
      return NextResponse.json(body, { status });
    }
    return NextResponse.json({ error: "Redemption failed" }, { status: 500 });
  }
}
