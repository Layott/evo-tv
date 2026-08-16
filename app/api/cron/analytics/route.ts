import { NextResponse, type NextRequest } from "next/server";
import { rollupDay, yesterdayYmd } from "@/lib/analytics/rollup";

/**
 * Cron entry point. Runs on the droplet's crontab, `cron.sh analytics` at
 * 02:00 Africa/Lagos.
 *
 * The caller sends `CRON_SECRET` as a bearer token. Reject anything else so
 * the route isn't abusable.
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
