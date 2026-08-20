import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { getPollById } from "@/lib/api/polls";

/**
 * GET /api/admin/polls/[id]/metrics
 *
 * How a poll is going, while it is going.
 *
 * The admin list showed a total and nothing else, so the person running the
 * broadcast could not answer the only two questions that matter in the moment:
 * is anybody voting, and is it close. Both are readable off `poll_votes`, which
 * has carried a timestamp all along and had nothing reading it.
 *
 * Staff see the real numbers even when the poll hides them from viewers.
 * Running the poll is the job.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const poll = await getPollById(id);
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  const votes = await db
    .select({
      optionId: schema.pollVotes.optionId,
      createdAt: schema.pollVotes.createdAt,
    })
    .from(schema.pollVotes)
    .where(eq(schema.pollVotes.pollId, id))
    .orderBy(asc(schema.pollVotes.createdAt));

  /*
   * Votes per minute since the poll opened, zero-filled.
   *
   * Zero-filled because a gap in the middle is the interesting part: it is the
   * moment the question stopped being interesting, and a chart that skips empty
   * minutes hides exactly that.
   */
  const openedAt = new Date(poll.createdAt).getTime();
  const lastAt = votes.length
    ? new Date(votes[votes.length - 1]!.createdAt).getTime()
    : openedAt;
  const closesAt = new Date(poll.closesAt).getTime();
  const endAt = Math.min(poll.isClosed ? lastAt : Date.now(), closesAt);
  const minutes = Math.max(1, Math.ceil((endAt - openedAt) / 60_000));

  const perMinute = new Array(Math.min(minutes, 120)).fill(0) as number[];
  for (const vote of votes) {
    const bucket = Math.floor((new Date(vote.createdAt).getTime() - openedAt) / 60_000);
    if (bucket >= 0 && bucket < perMinute.length) perMinute[bucket] += 1;
  }

  const byOption = new Map<string, number>();
  for (const vote of votes) {
    byOption.set(vote.optionId, (byOption.get(vote.optionId) ?? 0) + 1);
  }

  return NextResponse.json({
    pollId: poll.id,
    question: poll.question,
    isClosed: poll.isClosed,
    closesAt: poll.closesAt,
    totalVotes: votes.length,
    /** Distinct voters is the same number: one row per person per poll. */
    options: poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      votes: byOption.get(option.id) ?? 0,
      percent: votes.length
        ? Math.round(((byOption.get(option.id) ?? 0) / votes.length) * 100)
        : 0,
    })),
    perMinute,
    /** Votes in the last full minute, which is the number that reads as "live". */
    lastMinute: perMinute[perMinute.length - 1] ?? 0,
  });
}
