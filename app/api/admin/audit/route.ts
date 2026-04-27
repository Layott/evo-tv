import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { listAudit } from "@/lib/api/audit";

export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const actorId = url.searchParams.get("actorId") ?? undefined;
  const targetType = url.searchParams.get("targetType") ?? undefined;

  const data = await listAudit({
    limit: Number.isFinite(rawLimit) ? rawLimit : 100,
    offset: Number.isFinite(rawOffset) ? rawOffset : 0,
    actorId: actorId || undefined,
    targetType: targetType || undefined,
  });
  return NextResponse.json(data);
}
