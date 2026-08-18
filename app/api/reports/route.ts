import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { and, count, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { listScheduleForDay } from "@/lib/api/schedule";
import { zonedDateKey } from "@/lib/epg/grid";
import { getStreamById } from "@/lib/api/streams";

/**
 * What was on air, in the channel's own terms, at the moment of the report.
 *
 * A report against a 24/7 channel points at a stream that never stops, so the
 * target alone tells a moderator nothing: by the time the queue is read the
 * programme has moved on, possibly several times, and there is no way back to
 * what the reporter actually saw.
 *
 * Resolved here rather than accepted from the client for two reasons. It cannot
 * be spoofed to accuse a programme that was not running, and the client does not
 * necessarily know: the stream page shows a player, not the schedule.
 *
 * Never throws. A report with no context is still a report, and losing one
 * because a schedule lookup failed would be the wrong trade.
 */
async function onAirContext(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  if (targetType !== "stream") return null;
  try {
    const stream = await getStreamById(targetId);
    const now = new Date();
    const rows = await listScheduleForDay({ date: zonedDateKey(now) });
    const nowIso = now.toISOString();
    const onNow = rows.find((r) => {
      const end = new Date(
        new Date(r.airsAt).getTime() + r.durationMin * 60_000,
      ).toISOString();
      return r.airsAt <= nowIso && nowIso < end;
    });

    const parts = [`Reported at ${nowIso}`];
    if (stream) {
      parts.push(`Stream: ${stream.title}${stream.isLive ? " (live)" : ""}`);
    }
    if (onNow) {
      parts.push(
        `On air: ${onNow.title}${onNow.subtitle ? ` - ${onNow.subtitle}` : ""}`,
        `Slot: ${onNow.airsAt} for ${onNow.durationMin} min`,
      );
    } else {
      parts.push("On air: nothing scheduled for this slot");
    }
    return parts.join("\n");
  } catch {
    return null;
  }
}

const TARGET_TYPES = ["stream", "vod", "clip", "user", "chat_message", "party"] as const;
const CATEGORIES = [
  "spam",
  "abuse",
  "copyright",
  "illegal",
  "csam",
  "impersonation",
  "other",
] as const;

const createSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
  details: z.string().max(2000).optional(),
});

/**
 * POST /api/reports
 *
 * Any authenticated user submits a report against a target. Rate limited
 * loosely by recent-open count: if the reporter already has 20 open reports
 * (un-resolved), block further submissions until staff catches up.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { targetType, targetId, category, details } = parsed.data;

  const openCount = await db
    .select({ value: count() })
    .from(schema.contentReports)
    .where(
      and(
        eq(schema.contentReports.reporterUserId, user.id),
        eq(schema.contentReports.status, "open"),
      ),
    );
  if ((openCount[0]?.value ?? 0) >= 20) {
    return NextResponse.json(
      { error: "Too many open reports; wait for staff review" },
      { status: 429 },
    );
  }

  // Block reporting your own content/self.
  if (targetType === "user" && targetId === user.id) {
    return NextResponse.json(
      { error: "Cannot report yourself" },
      { status: 400 },
    );
  }

  const id = "rpt_" + crypto.randomBytes(8).toString("hex");
  await db.insert(schema.contentReports).values({
    id,
    reporterUserId: user.id,
    targetType,
    targetId,
    category,
    details: details ?? null,
    context: await onAirContext(targetType, targetId),
    status: "open",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, reportId: id });
}

/**
 * GET /api/reports - list MINE (reporter view). Auth required.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const rows = await db
    .select()
    .from(schema.contentReports)
    .where(eq(schema.contentReports.reporterUserId, user.id))
    .orderBy(desc(schema.contentReports.createdAt))
    .limit(100);

  return NextResponse.json({ reports: rows });
}
