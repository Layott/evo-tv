import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { emit } from "@/lib/sse/bus";

/**
 * POST /api/parties/[id]/sync — host broadcasts playback state.
 * Members listening on SSE /api/sse/party/[id] receive and reconcile.
 * No persistence — sync is ephemeral.
 */
const bodySchema = z.object({
  action: z.enum(["play", "pause", "seek"]),
  positionSec: z.number().nonnegative(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;

  const party = (
    await db
      .select({ hostUserId: schema.parties.hostUserId })
      .from(schema.parties)
      .where(eq(schema.parties.id, id))
      .limit(1)
  )[0];
  if (!party) return new NextResponse("Not found", { status: 404 });
  if (party.hostUserId !== user.id) {
    return new NextResponse("Only host can sync", { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  emit(`party:${id}:sync`, {
    type: parsed.data.action,
    positionSec: parsed.data.positionSec,
    at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
