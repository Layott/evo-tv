import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/payments/provider";
import { getCurrentUser } from "@/lib/auth/guards";
import { TIERS } from "@/lib/api/tiers";

/**
 * Start a subscription payment.
 *
 * This used to accept `plan: z.literal("premium")` and charge a
 * `PREMIUM_PRICE_NGN = 4_500` constant declared at the top of the file. Two
 * problems, and the second is the dangerous one.
 *
 * Supporter and Pro were unbuyable: the ladder has four tiers, this route
 * accepted one, so the other two paid plans 422'd whatever the UI did.
 *
 * And the price was a second copy of a number that lives in `lib/api/tiers.ts`.
 * Editing the ladder would have left this route charging the old amount with
 * nothing to catch it - no type error, no test, and a customer's card charged
 * the wrong figure. The amount now comes from the same list the pricing page
 * reads, so there is one number.
 *
 * `plan` also goes into the provider metadata, because the verify callback and
 * the webhook need to know what was bought to grant the right period. Before
 * this they both assumed Premium and 30 days.
 */
const bodySchema = z.object({
  plan: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Validate against the ladder rather than a hardcoded union, so adding a tier
  // is a data change. `priceNgn > 0` is what makes it purchasable, which also
  // rejects an attempt to "buy" the free tier.
  const tier = TIERS.find((t) => t.id === parsed.data.plan && t.priceNgn > 0);
  if (!tier) {
    return NextResponse.json(
      { error: "Unknown or non-purchasable plan", plan: parsed.data.plan },
      { status: 422 },
    );
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
    amountNgn: tier.priceNgn,
    email: user.email,
    reference,
    metadata: { userId: user.id, plan: tier.id },
    callbackUrl: `${origin}/api/payments/verify/${encodeURIComponent(reference)}`,
  });

  return NextResponse.json({
    provider: provider.id,
    redirectUrl: result.redirectUrl,
    reference: result.reference,
    accessCode: result.accessCode,
    amountNgn: tier.priceNgn,
    plan: tier.id,
    planName: tier.name,
  });
}
