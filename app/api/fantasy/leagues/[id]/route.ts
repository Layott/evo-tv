import { NextResponse, type NextRequest } from "next/server";
import { getLeagueById } from "@/lib/api/fantasy";

/** GET /api/fantasy/leagues/[id] - league detail. 404 when missing. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const league = await getLeagueById(id);
  if (!league) return new NextResponse("League not found", { status: 404 });
  return NextResponse.json(league);
}
