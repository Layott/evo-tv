import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { viewsOverTime } from "@/lib/api/analytics";
import { isDayKey, MAX_RANGE_DAYS } from "@/lib/analytics/range";

/**
 * GET /api/admin/analytics/views?days=30
 * GET /api/admin/analytics/views?from=2026-08-12&to=2026-08-19
 *
 * `from` on its own is a single day, which is the question the preset chips
 * could not ask.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && isDayKey(from)) {
    return NextResponse.json(
      await viewsOverTime({ from, to: to && isDayKey(to) ? to : from }),
    );
  }

  const raw = Number(url.searchParams.get("days") ?? "30");
  const days = Number.isFinite(raw)
    ? Math.max(1, Math.min(MAX_RANGE_DAYS, Math.trunc(raw)))
    : 30;
  return NextResponse.json(await viewsOverTime({ days }));
}
