import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { revenueByMonth } from "@/lib/api/analytics";

export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("months") ?? "6");
  const months = Number.isFinite(raw) ? raw : 6;
  const data = await revenueByMonth(months);
  return NextResponse.json(data);
}
