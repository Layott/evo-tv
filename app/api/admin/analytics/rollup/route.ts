import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { rollupDay, yesterdayYmd } from "@/lib/analytics/rollup";

/**
 * POST /api/admin/analytics/rollup  body={ date?: "YYYY-MM-DD" }
 *   Run the analytics_daily rollup for a date (defaults to yesterday UTC).
 *
 * Also used by the Vercel Cron entry at /api/cron/analytics — that route
 * just calls into this handler.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  let date = yesterdayYmd();
  try {
    const body = (await req.json().catch(() => null)) as { date?: string } | null;
    if (body?.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) date = body.date;
  } catch {
    /* default to yesterday */
  }

  const result = await rollupDay(date);
  return NextResponse.json(result);
}
