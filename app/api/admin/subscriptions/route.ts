import { NextResponse, type NextRequest } from "next/server";

import { requireMinRole } from "@/lib/auth/guards";
import { listAllSubscriptions, type SubStatus } from "@/lib/api/subscriptions";

const ALLOWED: SubStatus[] = ["active", "past_due", "canceled", "paused"];

/**
 * GET /api/admin/subscriptions - finance_admin+.
 *
 * Lists premium subscriptions joined to the owning user.
 * Filters: ?status=active|past_due|canceled|paused&limit=&offset=
 *
 * Reading the book is what the finance role exists for, so it is not gated at
 * `admin` the way the writes below are. Changing somebody's access period is
 * still an admin action.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("finance_admin");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status");
  const status =
    rawStatus && (ALLOWED as string[]).includes(rawStatus)
      ? (rawStatus as SubStatus)
      : undefined;
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const res = await listAllSubscriptions({
    status,
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  return NextResponse.json(res);
}
