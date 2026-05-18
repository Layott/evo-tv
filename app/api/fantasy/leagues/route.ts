import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import {
  createLeague,
  listLeagues,
  type FantasyStatus,
  type ScoringSystem,
} from "@/lib/api/fantasy";

/**
 * GET /api/fantasy/leagues?ownerId=&memberId=&status=&gameId=
 *
 * Returns the leagues matching the filter. `memberId=me` resolves to the
 * caller's userId. Public list — auth optional, but `memberId=me` requires
 * auth (401).
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  let memberId = sp.get("memberId") ?? undefined;

  if (memberId === "me") {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Auth required", { status: 401 });
    memberId = user.id;
  }

  const status = sp.get("status") as FantasyStatus | null;
  return NextResponse.json(
    await listLeagues({
      ownerId: sp.get("ownerId") ?? undefined,
      memberId,
      status: status && ["drafting", "active", "completed"].includes(status)
        ? (status as FantasyStatus)
        : undefined,
      gameId: sp.get("gameId") ?? undefined,
    }),
  );
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  gameId: z.string().min(1),
  maxMembers: z.number().int().min(2).max(100).optional(),
  salaryCap: z.number().int().min(1).max(1_000_000),
  prizePool: z.number().int().min(0).optional(),
  entryFee: z.number().int().min(0).optional(),
  scoringSystem: z.enum(["kills", "kda", "objectives"]),
  endsAt: z.string().min(1),
  bannerSeed: z.string().optional(),
});

/** POST /api/fantasy/leagues — create a league. Owner auto-joins. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const league = await createLeague({
    ownerId: user.id,
    name: parsed.data.name,
    description: parsed.data.description,
    gameId: parsed.data.gameId,
    maxMembers: parsed.data.maxMembers,
    salaryCap: parsed.data.salaryCap,
    prizePool: parsed.data.prizePool,
    entryFee: parsed.data.entryFee,
    scoringSystem: parsed.data.scoringSystem as ScoringSystem,
    endsAt: parsed.data.endsAt,
    bannerSeed: parsed.data.bannerSeed,
  });
  return NextResponse.json(league, { status: 201 });
}
