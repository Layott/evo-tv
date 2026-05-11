import { NextResponse, type NextRequest } from "next/server";
import { listTeams, getTeamBySlug } from "@/lib/api/teams";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (slug) {
    const team = await getTeamBySlug(slug);
    return NextResponse.json(team);
  }
  const gameId = searchParams.get("gameId") ?? undefined;
  return NextResponse.json(await listTeams({ gameId }));
}
