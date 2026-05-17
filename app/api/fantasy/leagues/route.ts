import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { listLeagues, type FantasyStatus } from "@/lib/api/fantasy";

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
