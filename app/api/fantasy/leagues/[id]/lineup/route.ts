import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { FantasyError, getLineup, upsertLineup } from "@/lib/api/fantasy";

/** GET /api/fantasy/leagues/[id]/lineup - caller's lineup (null if none). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;
  return NextResponse.json(await getLineup(id, user.id));
}

const submitSchema = z.object({
  picks: z
    .array(
      z.object({
        playerId: z.string().min(1).max(128),
        cost: z.number().int().min(0).max(1_000_000),
      }),
    )
    .min(1)
    .max(12),
});

/** POST /api/fantasy/leagues/[id]/lineup - upsert lineup. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const lineup = await upsertLineup(id, user.id, parsed.data.picks);
    return NextResponse.json(lineup);
  } catch (err) {
    if (err instanceof FantasyError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "not_member" || err.code === "locked"
            ? 409
            : 422;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
