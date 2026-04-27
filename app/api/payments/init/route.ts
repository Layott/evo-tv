import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/payments/provider";
import { getCurrentUser } from "@/lib/auth/guards";

const PREMIUM_PRICE_NGN = 4_500;

const bodySchema = z.object({
  plan: z.literal("premium"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const provider = getProvider();
  const reference =
    "ref_" +
    Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const origin = new URL(req.url).origin;
  const result = await provider.initCheckout({
    userId: user.id,
    amountNgn: PREMIUM_PRICE_NGN,
    email: user.email,
    reference,
    metadata: { userId: user.id, plan: parsed.data.plan },
    callbackUrl: `${origin}/api/payments/verify/${encodeURIComponent(reference)}`,
  });

  return NextResponse.json({
    provider: provider.id,
    redirectUrl: result.redirectUrl,
    reference: result.reference,
    accessCode: result.accessCode,
    amountNgn: PREMIUM_PRICE_NGN,
  });
}
