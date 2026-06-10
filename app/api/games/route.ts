import { NextResponse } from "next/server";
import { listGames } from "@/lib/api/games";

export async function GET() {
  const games = (await listGames())
    .filter((g) => g.enabled)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        a.displayOrder - b.displayOrder ||
        a.name.localeCompare(b.name),
    );
  return NextResponse.json(games);
}
