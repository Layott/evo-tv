import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { freeToPremiumConversionPct } from "@/lib/api/analytics";

export async function GET() {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const data = await freeToPremiumConversionPct();
  return NextResponse.json(data);
}
