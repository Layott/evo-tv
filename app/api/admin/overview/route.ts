import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth/guards";
import { adminOverview } from "@/lib/api/admin-overview";

/**
 * GET /api/admin/overview
 *
 * The whole admin landing page in one call. `/api/admin/analytics/overview`
 * stays for the four tiles it already served; this returns those plus the view
 * and watch-time figures, the 30-day series and the needs-attention list.
 */
export async function GET() {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;
  return NextResponse.json(await adminOverview());
}
