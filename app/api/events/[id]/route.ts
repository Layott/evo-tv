import { NextResponse } from "next/server";
import {
  getEventById,
  getEventBySlug,
  listMatchesForEvent,
} from "@/lib/api/events";

/**
 * Accepts an id or a slug. Event pages route on the slug, and resolving it here
 * saves the client a lookup round trip.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = (await getEventById(id)) ?? (await getEventBySlug(id));
  if (!event) return new NextResponse("Not found", { status: 404 });
  const matches = await listMatchesForEvent(event.id);
  return NextResponse.json({ event, matches });
}
