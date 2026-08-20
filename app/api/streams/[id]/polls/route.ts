import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, requireMinRole } from "@/lib/auth/guards";
import { hasMinRole } from "@/lib/auth/roles";
import { getStreamById } from "@/lib/api/streams";
import { createPoll, forViewer, listActivePolls, myVote } from "@/lib/api/polls";

const optionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
});

const createSchema = z.object({
  question: z.string().min(3).max(300),
  options: z.array(optionSchema).min(2).max(10),
  closesAt: z.string().min(1),
  /*
   * How the poll behaves, chosen per poll rather than set for the platform.
   * "Who takes Map 4" and "which show should we renew" are not the same event
   * and should not have the same rules.
   */
  whoCanVote: z.enum(["signed_in", "subscribers"]).default("signed_in"),
  showResultsLive: z.boolean().default(true),
  showWinnerOnStream: z.boolean().default(false),
  allowVoteChange: z.boolean().default(false),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });

  /*
   * A hidden result is hidden here, not on the screen.
   *
   * Sending the counts and asking the client not to draw them puts the answer
   * in the network tab of anybody curious, and the reason to hide them is that
   * nobody has them yet. Staff get the real numbers, because running the poll is
   * the job.
   */
  const user = await getCurrentUser();
  const staff = hasMinRole((user as { role?: string } | null)?.role, "support_admin");
  const polls = await listActivePolls(id);
  const shaped = await Promise.all(
    polls.map(async (poll) =>
      forViewer(poll, {
        staff,
        myVote: user ? await myVote(poll.id, user.id) : undefined,
      }),
    ),
  );
  return NextResponse.json({ polls: shaped });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // `role !== "admin"` was the test, which is false for a head_admin: the one
  // person who can never be locked out was locked out of starting a poll.
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Dedup option ids to avoid collisions.
  const ids = new Set(parsed.data.options.map((o) => o.id));
  if (ids.size !== parsed.data.options.length) {
    return NextResponse.json({ error: "Duplicate option ids" }, { status: 422 });
  }

  const poll = await createPoll({
    streamId: id,
    question: parsed.data.question,
    options: parsed.data.options,
    closesAt: parsed.data.closesAt,
    whoCanVote: parsed.data.whoCanVote,
    showResultsLive: parsed.data.showResultsLive,
    showWinnerOnStream: parsed.data.showWinnerOnStream,
    allowVoteChange: parsed.data.allowVoteChange,
  });
  return NextResponse.json({ poll });
}
