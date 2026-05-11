import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Subscription } from "@/lib/types";

function toSub(r: typeof schema.subscriptions.$inferSelect): Subscription {
  return {
    id: r.id,
    userId: r.userId,
    tier: r.tier as Subscription["tier"],
    status: r.status as Subscription["status"],
    provider: r.provider as Subscription["provider"],
    providerSubId: r.providerSubId,
    currentPeriodEnd: r.currentPeriodEnd,
    priceNgn: r.priceNgn,
    createdAt: r.createdAt,
  };
}

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const r = (
    await db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, userId),
          eq(schema.subscriptions.status, "active")
        )
      )
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(1)
  )[0];
  return r ? toSub(r) : null;
}

export async function listSubscriptionsForUser(userId: string): Promise<Subscription[]> {
  return (
    await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt))
  ).map(toSub);
}

export async function upsertFromPayment(input: {
  userId: string;
  provider: "paystack" | "mock";
  providerSubId: string;
  priceNgn: number;
  periodDays?: number;
}): Promise<Subscription> {
  const existing = await getActiveSubscription(input.userId);
  const nowIso = new Date().toISOString();
  const periodEnd = new Date(
    Date.now() + (input.periodDays ?? 30) * 86_400_000
  ).toISOString();

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set({
        status: "active",
        provider: input.provider,
        providerSubId: input.providerSubId,
        currentPeriodEnd: periodEnd,
        priceNgn: input.priceNgn,
      })
      .where(eq(schema.subscriptions.id, existing.id));
    const updated = (
      await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, existing.id))
        .limit(1)
    )[0];
    return toSub(updated!);
  }

  const id =
    "sub_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  await db
    .insert(schema.subscriptions)
    .values({
      id,
      userId: input.userId,
      tier: "premium",
      status: "active",
      provider: input.provider,
      providerSubId: input.providerSubId,
      currentPeriodEnd: periodEnd,
      priceNgn: input.priceNgn,
      createdAt: nowIso,
    });

  // Promote user role to premium.
  await db
    .update(schema.user)
    .set({ role: "premium", updatedAt: new Date() })
    .where(eq(schema.user.id, input.userId));

  return {
    id,
    userId: input.userId,
    tier: "premium",
    status: "active",
    provider: input.provider,
    providerSubId: input.providerSubId,
    currentPeriodEnd: periodEnd,
    priceNgn: input.priceNgn,
    createdAt: nowIso,
  };
}

export async function cancelSubscription(userId: string): Promise<void> {
  await db
    .update(schema.subscriptions)
    .set({ status: "canceled" })
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, "active")
      )
    );
  await db
    .update(schema.user)
    .set({ role: "user", updatedAt: new Date() })
    .where(eq(schema.user.id, userId));
}
