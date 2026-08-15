import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { createOrder, OrderValidationError } from "@/lib/api/orders";
import { getProvider } from "@/lib/payments/provider";
import { checkIdempotency, recordIdempotency } from "@/lib/http/idempotency";

/**
 * GET /api/orders - current user's orders, newest first.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.userId, user.id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);

  return NextResponse.json({ orders: rows });
}

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1).nullable().optional(),
        qty: z.number().int().min(1),
      })
    )
    .min(1),
  shipping: z.object({
    fullName: z.string().min(1),
    phone: z.string().min(1),
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
  }),
  paymentProvider: z.enum(["mock", "paystack"]).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const replay = await checkIdempotency(req, user.id);
  if (replay) return replay;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const paymentProvider = parsed.data.paymentProvider ?? "mock";

  let order;
  try {
    order = await createOrder({
      userId: user.id,
      items: parsed.data.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        qty: i.qty,
      })),
      shipping: parsed.data.shipping,
      paymentProvider,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      const status = err.code === "out_of_stock" ? 409 : 422;
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          productId: err.productId,
          variantId: err.variantId,
        },
        { status }
      );
    }
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  const provider = getProvider();
  const origin = new URL(req.url).origin;
  const init = await provider.initCheckout({
    userId: user.id,
    amountNgn: order.totalNgn,
    email: user.email,
    reference: order.paymentRef,
    metadata: { orderId: order.id, userId: user.id, kind: "shop" },
    callbackUrl: `${origin}/api/orders/${encodeURIComponent(order.id)}/confirm-payment`,
  });

  const responseBody = {
    order,
    redirectUrl: init.redirectUrl,
    reference: init.reference,
  };
  await recordIdempotency(req, user.id, 200, responseBody);
  return NextResponse.json(responseBody);
}
