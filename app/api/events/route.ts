import { NextResponse, type NextRequest } from "next/server";
import { listEvents } from "@/lib/api/events";
import type { EsportsEvent } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as EsportsEvent["status"] | null;
  const gameId = searchParams.get("gameId") ?? undefined;
  return NextResponse.json(
    await listEvents({ status: status ?? undefined, gameId })
  );
}
