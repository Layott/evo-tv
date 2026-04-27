import { NextResponse, type NextRequest } from "next/server";
import { paystack } from "@/lib/payments/provider";
import { upsertFromPayment } from "@/lib/api/subscriptions";
import { createNotification } from "@/lib/api/notifications";
import { emit } from "@/lib/sse/bus";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();

  try {
    const result = await paystack.handleWebhook(rawBody, signature);

    if (result.status === "success" && result.userId) {
      const sub = await upsertFromPayment({
        userId: result.userId,
        provider: "paystack",
        providerSubId: result.reference,
        priceNgn: result.amountNgn,
        periodDays: 30,
      });

      await createNotification({
        userId: result.userId,
        type: "subscription",
        title: "Payment received",
        body: "Your Premium subscription is now active.",
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
