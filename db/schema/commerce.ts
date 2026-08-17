import { pgTable, text, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { teams } from "./catalog";
import { user } from "./users";

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category", {
      enum: ["jersey", "apparel", "accessory", "digital", "collectible"],
    }).notNull(),
    priceNgn: integer("price_ngn").notNull(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    variants: jsonb("variants")
      .$type<{ id: string; label: string; priceNgn: number; inventory: number }[]>()
      .notNull()
      .default([]),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    /**
     * The show this came out of, when it came out of one.
     *
     * Nullable because most stock is not tied to a programme, and `set null`
     * rather than a cascade because a product that loses its show should keep
     * selling rather than vanish from the shop.
     */
    showId: text("show_id"),
    inventory: integer("inventory").notNull().default(0),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_show_idx").on(t.showId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"],
    }).notNull(),
    items: jsonb("items")
      .$type<
        {
          productId: string;
          productName: string;
          variantId: string | null;
          variantLabel: string | null;
          qty: number;
          unitPriceNgn: number;
          thumbnailUrl: string;
        }[]
      >()
      .notNull(),
    subtotalNgn: integer("subtotal_ngn").notNull(),
    shippingNgn: integer("shipping_ngn").notNull().default(0),
    totalNgn: integer("total_ngn").notNull(),
    shipping: jsonb("shipping").$type<{
      fullName: string;
      phone: string;
      address1: string;
      address2: string;
      city: string;
      state: string;
      country: string;
    } | null>(),
    paymentProvider: text("payment_provider", { enum: ["paystack", "mock", "stripe"] })
      .notNull()
      .default("mock"),
    paymentRef: text("payment_ref").notNull(),
    createdAt: text("created_at").notNull(),
    trackingNumber: text("tracking_number"),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tier: text("tier", { enum: ["free", "premium"] }).notNull(),
    status: text("status", { enum: ["active", "past_due", "canceled", "paused"] }).notNull(),
    provider: text("provider", { enum: ["paystack", "mock", "stripe"] }).notNull(),
    providerSubId: text("provider_sub_id").notNull().default(""),
    currentPeriodEnd: text("current_period_end").notNull(),
    priceNgn: integer("price_ngn").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("subs_user_idx").on(t.userId)],
);
