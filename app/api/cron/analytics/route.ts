import { NextResponse, type NextRequest } from "next/server";
import { rollupDay, yesterdayYmd } from "@/lib/analytics/rollup";

/**
 * Vercel Cron entry point. Configured in vercel.json:
 *   { "path": "/api/cron/analytics", "schedule": "0 2 * * *" }
 *
 * Vercel signs Cron-triggered requests with the `CRON_SECRET` env var as a
 * bearer token. Reject anything else so the route isn't abusable.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const date = yesterdayYmd();
  const result = await rollupDay(date);
  return NextResponse.json(result);
}
