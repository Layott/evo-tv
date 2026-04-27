import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";

const SHIPPING_FLAT_NGN = 2_500;
const FREE_SHIPPING_THRESHOLD_NGN = 50_000;

export function computeShipping(subtotalNgn: number): number {
  return subtotalNgn >= FREE_SHIPPING_THRESHOLD_NGN ? 0 : SHIPPING_FLAT_NGN;
}

function toOrder(r: typeof schema.orders.$inferSelect): Order {
  const shipping = r.shipping ?? {
    fullName: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    country: "",
  };
  return {
    id: r.id,
    userId: r.userId,
    status: r.status as OrderStatus,
    items: r.items,
    subtotalNgn: r.subtotalNgn,
    shippingNgn: r.shippingNgn,
    totalNgn: r.totalNgn,
    shipping: {
      fullName: shipping.fullName,
      phone: shipping.phone,
      address1: shipping.address1,
      address2: shipping.address2 ?? "",
      city: shipping.city,
      state: shipping.state,
      country: shipping.country,
    },
    // Type `Order.paymentProvider` only supports paystack|stripe in public
    // DTOs; collapse `mock` to `paystack` so shop orders paid in dev mode
    // still surface a valid enum to clients.
    paymentProvider:
      r.paymentProvider === "stripe" ? "stripe" : "paystack",
    paymentRef: r.paymentRef,
    createdAt: r.createdAt,
    trackingNumber: r.trackingNumber,
  };
}

function genOrderId(): string {
  return (
    "ord_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface CreateOrderItemInput {
  productId: string;
  variantId?: string | null;
  qty: number;
}

export interface CreateOrderInput {
  userId: string;
  items: CreateOrderItemInput[];
  shipping: {
    fullName: string;
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
  };
  paymentProvider: "paystack" | "mock" | "stripe";
}

export class OrderValidationError extends Error {
  code: "empty_cart" | "product_missing" | "variant_missing" | "out_of_stock";
  productId?: string;
  variantId?: string | null;
  constructor(
    code: OrderValidationError["code"],
    message: string,
    productId?: string,
    variantId?: string | null
  ) {
    super(message);
    this.code = code;
    this.productId = productId;
    this.variantId = variantId;
  }
}

/**
 * Validate stock, compute subtotal/shipping/total, insert an `orders` row in
 * `pending` state, and return the persisted order. Payment init is handled by
 * the caller via `getProvider().initCheckout`.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!input.items.length) {
    throw new OrderValidationError("empty_cart", "Cart is empty");
  }

  const enrichedItems: OrderItem[] = [];
  let subtotalNgn = 0;

  for (const line of input.items) {
    const product = db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, line.productId))
      .get();
    if (!product || !product.active) {
      throw new OrderValidationError(
        "product_missing",
        `Product ${line.productId} unavailable`,
        line.productId
      );
    }

    let unitPriceNgn = product.priceNgn;
    let variantLabel: string | null = null;
    let variantInventory = product.inventory;
    let variantId: string | null = null;

    if (line.variantId) {
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) {
        throw new OrderValidationError(
          "variant_missing",
          `Variant ${line.variantId} not found on product ${product.id}`,
          product.id,
          line.variantId
        );
      }
      unitPriceNgn = variant.priceNgn;
      variantLabel = variant.label;
      variantInventory = variant.inventory;
      variantId = variant.id;
    }

    if (variantInventory < line.qty) {
      throw new OrderValidationError(
        "out_of_stock",
        `Insufficient stock for ${product.name}`,
        product.id,
        variantId
      );
    }

    enrichedItems.push({
      productId: product.id,
      productName: product.name,
      variantId,
      variantLabel,
      qty: line.qty,
      unitPriceNgn,
      thumbnailUrl: product.images[0] ?? "",
    });
    subtotalNgn += unitPriceNgn * line.qty;
  }

  const shippingNgn = computeShipping(subtotalNgn);
  const totalNgn = subtotalNgn + shippingNgn;

  const id = genOrderId();
  const paymentRef = id.replace(/^ord_/, "ord_");
  const createdAt = new Date().toISOString();

  db.insert(schema.orders)
    .values({
      id,
      userId: input.userId,
      status: "pending",
      items: enrichedItems,
      subtotalNgn,
      shippingNgn,
      totalNgn,
      shipping: {
        fullName: input.shipping.fullName,
        phone: input.shipping.phone,
        address1: input.shipping.address1,
        address2: input.shipping.address2 ?? "",
        city: input.shipping.city,
        state: input.shipping.state,
        country: input.shipping.country,
      },
      paymentProvider: input.paymentProvider,
      paymentRef,
      createdAt,
      trackingNumber: null,
    })
    .run();

  const row = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, id))
    .get();
  return toOrder(row!);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const r = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, id))
    .get();
  return r ? toOrder(r) : null;
}

export async function getOrderByPaymentRef(ref: string): Promise<Order | null> {
  const r = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.paymentRef, ref))
    .get();
  return r ? toOrder(r) : null;
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  return db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.userId, userId))
    .orderBy(desc(schema.orders.createdAt))
    .all()
    .map(toOrder);
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  trackingNumber?: string | null
): Promise<Order | null> {
  const patch: Partial<typeof schema.orders.$inferInsert> = { status };
  if (trackingNumber !== undefined) patch.trackingNumber = trackingNumber;
  db.update(schema.orders).set(patch).where(eq(schema.orders.id, id)).run();
  return getOrderById(id);
}
