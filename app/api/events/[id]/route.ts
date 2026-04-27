import { NextResponse } from "next/server";
import { getEventById, listMatchesForEvent } from "@/lib/api/events";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return new NextResponse("Not found", { status: 404 });
  const matches = await listMatchesForEvent(id);
  return NextResponse.json({ event, matches });
}
