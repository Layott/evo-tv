import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { viewsOverTime } from "@/lib/api/analytics";

export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("days") ?? "30");
  const days = Number.isFinite(raw) ? raw : 30;
  const data = await viewsOverTime(days);
  return NextResponse.json(data);
}
