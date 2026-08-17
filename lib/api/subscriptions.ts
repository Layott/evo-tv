import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { roleRank } from "@/lib/auth/role-catalog";
import type { Subscription } from "@/lib/types";

/**
 * Grant or remove the paid role without touching a role that outranks it.
 *
 * Paying used to `set({ role: "premium" })` unconditionally, and cancelling set
 * it to `"user"`. Role and subscription are two different things sharing one
 * column, so the result was that **anyone on staff who bought a subscription
 * lost their staff role**: an admin became `premium`, and when the subscription
 * lapsed they became `user`. A creator lost creator the same way.
 *
 * Found the honest way. A walkthrough account was promoted to `head_admin`,
 * used to exercise checkout, and came back as `premium` with every admin route
 * answering 403.
 *
 * So the rule is: subscriptions may only move somebody between `user` and
 * `premium`. Anything above `premium` on the ladder is a decision somebody made
 * about that person and is none of billing's business.
 */
async function setPaidRole(userId: string, paid: boolean): Promise<void> {
  const rows = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  const current = rows[0]?.role ?? "user";
  if (roleRank(current) > roleRank("premium")) return;

  await db
    .update(schema.user)
    .set({ role: paid ? "premium" : "user", updatedAt: new Date() })
    .where(eq(schema.user.id, userId));
}

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

  await setPaidRole(input.userId, true);

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
  await setPaidRole(userId, false);
}

/* ------------------------------------------------------------------ */
/* Admin billing                                                      */
/* ------------------------------------------------------------------ */

export type SubStatus = "active" | "past_due" | "canceled" | "paused";

export interface AdminSubscriptionRow extends Subscription {
  userEmail: string;
  userName: string;
  userHandle: string | null;
}

/** Admin list of subscriptions joined to the owning user. */
export async function listAllSubscriptions(
  opts: { status?: SubStatus; limit?: number; offset?: number } = {}
): Promise<{
  subscriptions: AdminSubscriptionRow[];
  total: number;
  limit: number;
  offset: number;
}> {
  const limit = Math.max(1, Math.min(200, Math.trunc(opts.limit ?? 100)));
  const offset = Math.max(0, Math.trunc(opts.offset ?? 0));
  const whereClause = opts.status
    ? eq(schema.subscriptions.status, opts.status)
    : undefined;

  const rows = await db
    .select({
      id: schema.subscriptions.id,
      userId: schema.subscriptions.userId,
      tier: schema.subscriptions.tier,
      status: schema.subscriptions.status,
      provider: schema.subscriptions.provider,
      providerSubId: schema.subscriptions.providerSubId,
      currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
      priceNgn: schema.subscriptions.priceNgn,
      createdAt: schema.subscriptions.createdAt,
      userEmail: schema.user.email,
      userName: schema.user.name,
      userHandle: schema.user.handle,
    })
    .from(schema.subscriptions)
    .innerJoin(schema.user, eq(schema.user.id, schema.subscriptions.userId))
    .where(whereClause)
    .orderBy(desc(schema.subscriptions.createdAt))
    .limit(limit)
    .offset(offset);

  const totalRow = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(whereClause)
      .limit(1)
  )[0];

  return {
    subscriptions: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      tier: r.tier as Subscription["tier"],
      status: r.status as Subscription["status"],
      provider: r.provider as Subscription["provider"],
      providerSubId: r.providerSubId,
      currentPeriodEnd: r.currentPeriodEnd,
      priceNgn: r.priceNgn,
      createdAt: r.createdAt,
      userEmail: r.userEmail,
      userName: r.userName,
      userHandle: r.userHandle,
    })),
    total: Number(totalRow?.c ?? 0),
    limit,
    offset,
  };
}

/** Cancel one subscription by id; demote the user if they have no other active sub. */
export async function cancelSubscriptionById(
  id: string
): Promise<Subscription | null> {
  const row = (
    await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1)
  )[0];
  if (!row) return null;

  await db
    .update(schema.subscriptions)
    .set({ status: "canceled" })
    .where(eq(schema.subscriptions.id, id));

  const stillActive = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, row.userId),
          eq(schema.subscriptions.status, "active")
        )
      )
      .limit(1)
  )[0];
  if (Number(stillActive?.c ?? 0) === 0) {
    await setPaidRole(row.userId, false);
  }

  return toSub({ ...row, status: "canceled" });
}

/** Extend a subscription's period by N days (from max(now, current end)); keeps it active. */
export async function extendSubscriptionById(
  id: string,
  days: number
): Promise<Subscription | null> {
  const row = (
    await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1)
  )[0];
  if (!row) return null;

  const cur = new Date(row.currentPeriodEnd).getTime();
  const base = Number.isNaN(cur) ? Date.now() : Math.max(Date.now(), cur);
  const newEnd = new Date(base + days * 86_400_000).toISOString();

  await db
    .update(schema.subscriptions)
    .set({ status: "active", currentPeriodEnd: newEnd })
    .where(eq(schema.subscriptions.id, id));

  if (row.tier === "premium") {
    await setPaidRole(row.userId, true);
  }

  return toSub({ ...row, status: "active", currentPeriodEnd: newEnd });
}
