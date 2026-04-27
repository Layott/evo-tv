import type { Order } from "@/lib/types";
import { sleep, byId, daysAgo } from "./_util";

export const orders: Order[] = [
  {
    id: "order_recent",
    userId: "user_current",
    status: "shipped",
    items: [
      {
        productId: "prod_alpha_jersey",
        productName: "Team Alpha Official Jersey 2026",
        variantId: "m",
        variantLabel: "M",
        qty: 1,
        unitPriceNgn: 38_000,
        thumbnailUrl: "/team-alpha-jersey.jpg",
      },
    ],
    subtotalNgn: 38_000,
    shippingNgn: 2_500,
    totalNgn: 40_500,
    shipping: {
      fullName: "Ade Nipebi",
      phone: "+234 803 123 4567",
      address1: "12 Adeola Odeku St",
      address2: "Apt 4B",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    paymentProvider: "paystack",
    paymentRef: "PS_REF_12345",
    createdAt: daysAgo(5),
    trackingNumber: "NIPOST-9F3A1K",
  },
  {
    id: "order_delivered",
    userId: "user_current",
    status: "delivered",
    items: [
      {
        productId: "prod_evo_hoodie",
        productName: "EVO TV Classic Hoodie",
        variantId: "l",
        variantLabel: "L",
        qty: 1,
        unitPriceNgn: 28_500,
        thumbnailUrl: "/evo-hoodie.jpg",
      },
      {
        productId: "prod_champs_cap",
        productName: "EVO Championship Snapback 2026",
        variantId: null,
        variantLabel: null,
        qty: 1,
        unitPriceNgn: 12_000,
        thumbnailUrl: "/championship-cap.jpg",
      },
    ],
    subtotalNgn: 40_500,
    shippingNgn: 2_500,
    totalNgn: 43_000,
    shipping: {
      fullName: "Ade Nipebi",
      phone: "+234 803 123 4567",
      address1: "12 Adeola Odeku St",
      address2: "Apt 4B",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    paymentProvider: "paystack",
    paymentRef: "PS_REF_11220",
    createdAt: daysAgo(28),
    trackingNumber: "NIPOST-4K9Z2E",
  },
];

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  await sleep();
  return orders
    .filter((o) => o.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getOrderById(id: string): Promise<Order | null> {
  await sleep();
  return byId(orders, id);
}
