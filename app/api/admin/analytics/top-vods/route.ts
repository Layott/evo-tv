import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { topVods } from "@/lib/api/analytics";

export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(raw) ? raw : 10;
  const data = await topVods(limit);
  return NextResponse.json(data);
}
