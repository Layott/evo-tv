import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { inArray, isNull, and } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { createNotification } from "@/lib/api/notifications";
import { sendExpoPushToUser } from "@/lib/api/expo-push";
import { sendPushToUser } from "@/lib/push";
import { writeAudit } from "@/lib/api/audit";
import { RANK, type PlatformRole } from "@/lib/auth/role-catalog";

/**
 * Tell the admins the channel is eating the month's bandwidth.
 *
 * EVO TV serves its own HLS, so the cost of being watched is transfer out of
 * the droplet, and the droplet's allowance is the budget. An allowance is only
 * a ceiling if somebody hears about it before it is spent, and a graph nobody
 * opens is not somebody hearing about it.
 *
 * `deploy/bandwidth-watch.sh` owns the counting and the "have I already said
 * this" state, because the interface counter lives on the box and resets on
 * reboot. This endpoint only delivers: it is called when a threshold is first
 * crossed in a billing month, never on a schedule.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}, same as the other crons.
 */

const bodySchema = z.object({
  /** Transfer out, month to date. */
  usedGb: z.number().nonnegative(),
  /** What the plan includes. 4096 on the current droplet. */
  allowanceGb: z.number().positive(),
  /** Which threshold tripped, so the copy can say the right thing. */
  thresholdPct: z.number().int().min(1).max(100),
  /** Billing month, `YYYY-MM`, so a repeat within the month is visible. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

/** Everyone from `admin` up. Below that nobody can act on it anyway. */
const ADMIN_ROLES = (Object.keys(RANK) as PlatformRole[]).filter(
  (r) => RANK[r] >= RANK.admin,
);

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { usedGb, allowanceGb, thresholdPct, month } = parsed.data;

  const remainingGb = Math.max(0, allowanceGb - usedGb);
  // At 720p a viewer costs about 0.68 GB an hour. Saying what is left in hours
  // of viewing is the number somebody can act on; gigabytes are not.
  const viewerHoursLeft = Math.round(remainingGb / 0.68);

  const title =
    thresholdPct >= 95
      ? "Bandwidth almost gone"
      : `Bandwidth at ${thresholdPct}% for ${month}`;
  const body =
    thresholdPct >= 95
      ? `${usedGb.toFixed(0)} GB of ${allowanceGb.toFixed(0)} GB used. Roughly ${viewerHoursLeft.toLocaleString()} viewer-hours left before overage is charged.`
      : `${usedGb.toFixed(0)} GB of ${allowanceGb.toFixed(0)} GB used this month, about ${viewerHoursLeft.toLocaleString()} viewer-hours of 720p left.`;

  const admins = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(
      and(
        inArray(schema.user.role, ADMIN_ROLES),
        isNull(schema.user.deletedAt),
      ),
    );

  let notified = 0;
  let pushed = 0;
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "system",
      title,
      body,
      linkUrl: "/admin/analytics",
    });
    notified += 1;
    pushed += await sendExpoPushToUser(admin.id, {
      title,
      body,
      data: { kind: "bandwidth", thresholdPct, month },
    });
    pushed += await sendPushToUser(admin.id, {
      title,
      body,
      url: "/admin/analytics",
    });
  }

  await writeAudit({
    actorId: null,
    action: "bandwidth.threshold",
    before: null,
    after: { usedGb, allowanceGb, thresholdPct, month, notified, pushed },
    targetType: "system",
    targetId: "cron",
    meta: { usedGb, allowanceGb, thresholdPct, month, notified, pushed },
  });

  return NextResponse.json({ ok: true, notified, pushed, viewerHoursLeft });
}
