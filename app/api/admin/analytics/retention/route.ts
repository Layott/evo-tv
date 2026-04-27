import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { retentionCohort } from "@/lib/api/analytics";

export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("weeks") ?? "8");
  const weeks = Number.isFinite(raw) ? raw : 8;
  const data = await retentionCohort(weeks);
  return NextResponse.json(data);
}
