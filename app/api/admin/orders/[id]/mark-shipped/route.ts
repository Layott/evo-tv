import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateId } from "@/lib/api/admin";
import { requireMinRole } from "@/lib/auth/guards";
import { getOrderById, updateOrderStatus } from "@/lib/api/orders";
import { createNotification } from "@/lib/api/notifications";
import { db, schema } from "@/lib/db";
import { emit } from "@/lib/sse/bus";

const bodySchema = z.object({
  trackingNumber: z.string().min(1).max(200),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Fulfilment is finance's job as much as an admin's, and it is the action
  // that closes an order somebody is waiting on.
  const guard = await requireMinRole("finance_admin");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await getOrderById(id);
  if (!existing) return new NextResponse("Not found", { status: 404 });

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

  const order = await updateOrderStatus(
    id,
    "shipped",
    parsed.data.trackingNumber
  );
  if (!order) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  // `order` isn't in the shared AuditTargetType enum, so insert directly so
  // we don't widen the helper signature for other agents.
  try {
    await db
      .insert(schema.auditLog)
      .values({
        id: generateId("audit"),
        actorId: guard.user.id,
        action: "order.ship",
        targetType: "order",
        targetId: id,
        meta: {
          trackingNumber: parsed.data.trackingNumber,
          newStatus: "shipped",
        },
        createdAt: new Date().toISOString(),
      });
  } catch {
    // best-effort
  }

  await createNotification({
    userId: order.userId,
    type: "order_update",
    title: "Your order shipped",
    body: `Tracking number: ${parsed.data.trackingNumber}`,
    imageUrl: order.items[0]?.thumbnailUrl ?? null,
    linkUrl: `/order/${order.id}`,
  });
  emit(`user:${order.userId}:notification`, { type: "order_update", order });

  return NextResponse.json({ order });
}
