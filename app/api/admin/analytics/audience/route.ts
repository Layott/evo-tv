import { NextResponse, type NextRequest } from "next/server";

import { requireAdminFromRequest } from "@/lib/api/admin";
import { audienceReport } from "@/lib/api/audience";
import { isDayKey, MAX_RANGE_DAYS } from "@/lib/analytics/range";

/**
 * GET /api/admin/analytics/audience?days=30
 * GET /api/admin/analytics/audience?from=2026-08-12&to=2026-08-19
 *
 * Who watched the channel, from the beats the players already send. Same range
 * grammar as the views endpoint beside it, so the date picker on the page
 * drives both.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && isDayKey(from)) {
    return NextResponse.json(
      await audienceReport({ from, to: to && isDayKey(to) ? to : from }),
    );
  }

  const raw = Number(url.searchParams.get("days") ?? "30");
  const days = Number.isFinite(raw)
    ? Math.max(1, Math.min(MAX_RANGE_DAYS, Math.trunc(raw)))
    : 30;
  return NextResponse.json(await audienceReport({ days }));
}
