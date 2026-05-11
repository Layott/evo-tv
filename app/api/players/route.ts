import { NextResponse, type NextRequest } from "next/server";
import { listPlayers } from "@/lib/api/players";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId") ?? undefined;
  const gameId = searchParams.get("gameId") ?? undefined;
  return NextResponse.json(await listPlayers({ teamId, gameId }));
}
