import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { overviewMetrics } from "@/lib/api/analytics";

export async function GET() {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const data = await overviewMetrics();
  return NextResponse.json(data);
}
