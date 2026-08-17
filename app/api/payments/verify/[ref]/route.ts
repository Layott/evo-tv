import { NextResponse } from "next/server";
import { getProvider } from "@/lib/payments/provider";
import { TIERS } from "@/lib/api/tiers";
import { upsertFromPayment } from "@/lib/api/subscriptions";
import { createNotification } from "@/lib/api/notifications";
import { emit } from "@/lib/sse/bus";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const provider = getProvider();
  const result = await provider.verify(ref);

  if (result.status !== "success" || !result.userId) {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/settings/billing?payment=failed&ref=${ref}`);
  }

  // Which plan was paid for, from the metadata set at init. The period and the
  // wording both used to be hardcoded to Premium and 30 days, which was correct
  // only for as long as Premium was the only purchasable tier.
  const tier = TIERS.find((t) => t.id === result.plan && t.priceNgn > 0);

  const sub = await upsertFromPayment({
    userId: result.userId,
    provider: provider.id === "paystack" ? "paystack" : "mock",
    providerSubId: result.reference,
    priceNgn: result.amountNgn,
    periodDays: tier?.periodDays ?? 30,
  });

  const planName = tier?.name ?? "Premium";
  await createNotification({
    userId: result.userId,
    type: "subscription",
    title: `Welcome to ${planName}`,
    body: `Your ${planName} subscription is active until ${new Date(sub.currentPeriodEnd).toLocaleDateString("en-NG")}.`,
    imageUrl: null,
    linkUrl: "/settings/billing",
  });
  emit(`user:${result.userId}:notification`, { type: "subscription", sub });

  const origin = new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/settings/billing?payment=success`);
}
