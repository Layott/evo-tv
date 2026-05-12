import { NextResponse, type NextRequest } from "next/server";
import {
  addDaysYmd,
  lastWeekStartYmd,
  rollupPayoutsWeek,
} from "@/lib/payouts/rollup";

/**
 * Vercel Cron entry. Schedule: weekly Sunday 03:00 UTC (after analytics
 * rollup at 02:00 the same day for the prior Saturday).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const start = lastWeekStartYmd();
  const end = addDaysYmd(start, 7);
  const result = await rollupPayoutsWeek(start, end);
  return NextResponse.json(result);
}
