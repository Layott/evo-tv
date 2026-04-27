import { NextResponse } from "next/server";
import { listGames } from "@/lib/api/games";

export async function GET() {
  return NextResponse.json(await listGames());
}
