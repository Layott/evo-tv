import { NextResponse, type NextRequest } from "next/server";
import { paystack } from "@/lib/payments/provider";
import { TIERS } from "@/lib/api/tiers";
import { upsertFromPayment } from "@/lib/api/subscriptions";
import { createNotification } from "@/lib/api/notifications";
import { emit } from "@/lib/sse/bus";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();

  try {
    const result = await paystack.handleWebhook(rawBody, signature);

    if (result.status === "success" && result.userId) {
      // Same plan lookup as the verify callback. The webhook is the path that
      // actually fires in production, so hardcoding Premium here would have
      // been the one that reached real customers.
      const tier = TIERS.find((t) => t.id === result.plan && t.priceNgn > 0);
      const planName = tier?.name ?? "Premium";

      const sub = await upsertFromPayment({
        userId: result.userId,
        provider: "paystack",
        providerSubId: result.reference,
        priceNgn: result.amountNgn,
        periodDays: tier?.periodDays ?? 30,
      });

      await createNotification({
        userId: result.userId,
        type: "subscription",
        title: "Payment received",
        body: `Your ${planName} subscription is now active.`,
        imageUrl: null,
        linkUrl: "/settings/billing",
      });
      emit(`user:${result.userId}:notification`, { type: "subscription", sub });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return new NextResponse(
      `Webhook verify failed: ${(err as Error).message}`,
      { status: 400 }
    );
  }
}
