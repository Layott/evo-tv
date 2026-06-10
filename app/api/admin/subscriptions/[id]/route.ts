import { NextResponse, type NextRequest } from "next/server";

import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import {
  cancelSubscriptionById,
  extendSubscriptionById,
} from "@/lib/api/subscriptions";

/**
 * PATCH /api/admin/subscriptions/[id] — admin+.
 *
 * Body:
 *   { "action": "cancel" }                 — cancel + demote user if no other active sub
 *   { "action": "extend", "days": 30 }     — extend currentPeriodEnd by N days (1-365, default 30)
 *
 * No refunds — billing here manages access periods only; money movement stays
 * with the payment provider.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    days?: number;
  } | null;
  if (!body || !body.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  if (body.action === "cancel") {
    const sub = await cancelSubscriptionById(id);
    if (!sub) return new NextResponse("Subscription not found", { status: 404 });
    // Best-effort audit — never fail a committed state change on a log write.
    await writeAudit({
      actorId: guard.user.id,
      action: "subscription.cancel",
      targetType: "subscription",
      targetId: id,
      meta: { role: guard.role, userId: sub.userId },
    }).catch(() => {});
    return NextResponse.json({ ok: true, subscription: sub });
  }

  if (body.action === "extend") {
    const days =
      typeof body.days === "number" &&
      Number.isFinite(body.days) &&
      body.days > 0 &&
      body.days <= 365
        ? Math.round(body.days)
        : 30;
    const sub = await extendSubscriptionById(id, days);
    if (!sub) return new NextResponse("Subscription not found", { status: 404 });
    await writeAudit({
      actorId: guard.user.id,
      action: "subscription.extend",
      targetType: "subscription",
      targetId: id,
      meta: { role: guard.role, userId: sub.userId, days, newEnd: sub.currentPeriodEnd },
    }).catch(() => {});
    return NextResponse.json({ ok: true, subscription: sub });
  }

  return NextResponse.json(
    { error: "action must be 'cancel' or 'extend'" },
    { status: 400 },
  );
}
