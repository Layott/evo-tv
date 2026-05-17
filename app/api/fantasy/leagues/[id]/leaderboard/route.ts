import { NextResponse, type NextRequest } from "next/server";
import { listLeaderboard } from "@/lib/api/fantasy";

/** GET /api/fantasy/leagues/[id]/leaderboard — sorted by total points desc. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listLeaderboard(id));
}
