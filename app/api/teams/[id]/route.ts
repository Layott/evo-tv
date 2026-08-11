import { NextResponse, type NextRequest } from "next/server";
import { getTeamById, getTeamBySlug } from "@/lib/api/teams";

/**
 * Accepts an id or a slug, and 404s on a miss.
 *
 * It previously returned `null` with a 200 for an unknown team, which the client
 * cannot tell apart from a team that exists but has no fields.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const team = (await getTeamById(id)) ?? (await getTeamBySlug(id));
  if (!team) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(team);
}
