import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { getEntitlements } from "@/lib/api/entitlements";
import { forViewer, getPollById, myVote, vote } from "@/lib/api/polls";

const schema = z.object({
  optionId: z.string().min(1).max(64),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  /*
   * Who the poll is for, checked before the vote rather than after.
   *
   * "Subscribers only" is a promise to the people paying for it, and a promise
   * enforced on the screen is not enforced at all: the endpoint is one fetch
   * away for anybody who opens the console.
   */
  const existing = await getPollById(id);
  if (!existing) return new NextResponse("Not found", { status: 404 });

  if (existing.whoCanVote === "subscribers") {
    const entitlements = await getEntitlements(user.id, (user as { role?: string }).role);
    if (!entitlements.premiumContent) {
      return NextResponse.json(
        { error: "This poll is for subscribers" },
        { status: 403 },
      );
    }
  }

  if (!existing.allowVoteChange) {
    const already = await myVote(id, user.id);
    if (already && already !== parsed.data.optionId) {
      return NextResponse.json(
        { error: "This poll does not allow changing your vote" },
        { status: 409 },
      );
    }
  }

  const poll = await vote({
    userId: user.id,
    pollId: id,
    optionId: parsed.data.optionId,
  });
  if (!poll) return new NextResponse("Not found", { status: 404 });
  const shaped = forViewer(poll, { myVote: parsed.data.optionId });
  if (poll.isClosed) {
    return NextResponse.json({ error: "Poll is closed", poll: shaped }, { status: 409 });
  }
  return NextResponse.json({ poll: shaped });
}
