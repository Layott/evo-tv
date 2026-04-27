import { NextResponse } from "next/server";
import { getProvider } from "@/lib/payments/provider";
import { getOrderById, updateOrderStatus } from "@/lib/api/orders";
import { createNotification } from "@/lib/api/notifications";
import { sendMail } from "@/lib/email";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { emit } from "@/lib/sse/bus";

function ngn(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function renderOrderEmail(order: Awaited<ReturnType<typeof getOrderById>>): string {
  if (!order) return "";
  const rows = order.items
    .map(
      (it) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${it.productName}${
          it.variantLabel ? ` &middot; ${it.variantLabel}` : ""
        }</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${ngn(
          it.unitPriceNgn * it.qty
        )}</td></tr>`
    )
    .join("");
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#0b0b0f;color:#e6e6e6;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#14141c;border-radius:12px;padding:24px">
    <h1 style="color:#fff;margin:0 0 16px">Order confirmed</h1>
    <p style="margin:0 0 8px">Thanks for your order with EVO TV. Your payment has been received.</p>
    <p style="margin:0 0 16px;color:#9aa0a6">Order <strong style="color:#fff">${order.id}</strong></p>
    <table style="width:100%;border-collapse:collapse;background:#0f0f17;border-radius:8px;overflow:hidden">
      <thead><tr><th style="text-align:left;padding:8px 12px;background:#1b1b26">Item</th><th style="padding:8px 12px;background:#1b1b26">Qty</th><th style="text-align:right;padding:8px 12px;background:#1b1b26">Line</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Subtotal</span><strong>${ngn(order.subtotalNgn)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Shipping</span><strong>${ngn(order.shippingNgn)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #2a2a38;margin-top:8px"><span>Total</span><strong style="color:#fff">${ngn(order.totalNgn)}</strong></div>
    </div>
    <p style="margin-top:24px;color:#9aa0a6;font-size:13px">Shipping to ${order.shipping.fullName}, ${order.shipping.address1}${
      order.shipping.address2 ? ", " + order.shipping.address2 : ""
    }, ${order.shipping.city}, ${order.shipping.state}, ${order.shipping.country}.</p>
  </div>
</body></html>`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const origin = new URL(req.url).origin;

  const existing = await getOrderById(id);
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const provider = getProvider();
  const result = await provider.verify(existing.paymentRef);

  if (result.status !== "success") {
    return NextResponse.redirect(`${origin}/cart?payment=failed&order=${id}`);
  }

  // Idempotent: only transition pending -> paid and fire the email once.
  let order = existing;
  if (existing.status === "pending") {
    const updated = await updateOrderStatus(id, "paid");
    if (updated) order = updated;

    // Decrement inventory per line (variant-aware).
    for (const item of order.items) {
      const product = db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, item.productId))
        .get();
      if (!product) continue;
      if (item.variantId) {
        const newVariants = product.variants.map((v) =>
          v.id === item.variantId
            ? { ...v, inventory: Math.max(0, v.inventory - item.qty) }
            : v
        );
        db.update(schema.products)
          .set({ variants: newVariants })
          .where(eq(schema.products.id, product.id))
          .run();
      } else {
        db.update(schema.products)
          .set({ inventory: Math.max(0, product.inventory - item.qty) })
          .where(eq(schema.products.id, product.id))
          .run();
      }
    }

    // Notify user in-app.
    await createNotification({
      userId: order.userId,
      type: "order_update",
      title: "Payment received",
      body: `Your order ${order.id} is confirmed. We'll email a tracking number once it ships.`,
      imageUrl: order.items[0]?.thumbnailUrl ?? null,
      linkUrl: `/order/${order.id}`,
    });
    emit(`user:${order.userId}:notification`, { type: "order_update", order });

    // Email receipt. Look up email from the users table (avoids pulling auth).
    const buyer = db
      .select({ email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, order.userId))
      .get();
    if (buyer?.email) {
      try {
        await sendMail({
          to: buyer.email,
          subject: `EVO TV order ${order.id} confirmed`,
          html: renderOrderEmail(order),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[order] email send failed", err);
      }
    }
  }

  // Accept both ?redirect=0 (JSON) and default (302).
  const url = new URL(req.url);
  if (url.searchParams.get("redirect") === "0") {
    return NextResponse.json({ order });
  }
  return NextResponse.redirect(`${origin}/order/${order.id}?payment=success`);
}
