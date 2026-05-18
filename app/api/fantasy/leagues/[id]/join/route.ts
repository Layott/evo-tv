import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { FantasyError, joinLeague } from "@/lib/api/fantasy";

/** POST /api/fantasy/leagues/[id]/join — join (member cap enforced). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;
  try {
    await joinLeague(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FantasyError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "league_full"
            ? 409
            : err.code === "already_member"
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
