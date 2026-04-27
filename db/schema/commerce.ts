import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { teams } from "./catalog";
import { user } from "./users";

export const products = sqliteTable(
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
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
    variants: text("variants", { mode: "json" })
      .$type<{ id: string; label: string; priceNgn: number; inventory: number }[]>()
      .notNull()
      .default([]),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    inventory: integer("inventory").notNull().default(0),
  },
  (t) => [index("products_category_idx").on(t.category)]
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"],
    }).notNull(),
    items: text("items", { mode: "json" })
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
    shipping: text("shipping", { mode: "json" }).$type<{
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
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)]
);

export const subscriptions = sqliteTable(
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
  (t) => [index("subs_user_idx").on(t.userId)]
);
