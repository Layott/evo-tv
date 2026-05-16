import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { listContinueWatching } from "@/lib/api/shows";

export const dynamic = "force-dynamic";

/** GET /api/originals/continue-watching?limit=6 — auth required. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const raw = Number(req.nextUrl.searchParams.get("limit") ?? "6");
  const limit = Math.max(1, Math.min(20, Number.isFinite(raw) ? raw : 6));
  const rows = await listContinueWatching(user.id, limit);
  return NextResponse.json({ items: rows });
}
