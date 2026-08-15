import { NextResponse } from "next/server";
import { listMatchesForEvent } from "@/lib/api/events";

/**
 * GET /api/events/[id]/matches - public.
 *
 * RN client (lib/api/events.ts:listMatchesForEvent) calls this path
 * directly. Previously RN had to fetch /api/events/[id] and project
 * `.matches`, but that pulls the whole event payload - wasteful for
 * screens that only need the match list.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matches = await listMatchesForEvent(id);
  return NextResponse.json(matches);
}
