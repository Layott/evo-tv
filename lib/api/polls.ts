import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emit } from "@/lib/sse/bus";
import type { Poll, PollOption } from "@/lib/types";

function shortId(prefix: string): string {
  return (
    prefix +
    "_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function toPoll(r: typeof schema.polls.$inferSelect): Poll {
  return {
    id: r.id,
    streamId: r.streamId,
    question: r.question,
    options: r.options,
    createdAt: r.createdAt,
    closesAt: r.closesAt,
    isClosed: r.isClosed,
    totalVotes: r.totalVotes,
    whoCanVote: (r.whoCanVote === "subscribers" ? "subscribers" : "signed_in"),
    showResultsLive: r.showResultsLive,
    showWinnerOnStream: r.showWinnerOnStream,
    allowVoteChange: r.allowVoteChange,
  };
}

/**
 * The poll as this viewer is allowed to see it.
 *
 * A poll with the results hidden has to be hidden on the server. Sending the
 * counts and asking the screen not to draw them puts the answer in the network
 * tab of anyone who wants it, and the whole point of hiding them is that nobody
 * has it yet. Staff see the real numbers, because running the poll is their job.
 */
export function forViewer(
  poll: Poll,
  opts: { staff?: boolean; myVote?: string | null } = {},
): Poll {
  const withVote: Poll =
    opts.myVote === undefined ? poll : { ...poll, myVote: opts.myVote };
  if (poll.showResultsLive || poll.isClosed || opts.staff) return withVote;
  return {
    ...withVote,
    options: withVote.options.map((o) => ({ ...o, votes: 0 })),
    totalVotes: 0,
  };
}

/** What this viewer picked, or null. */
export async function myVote(
  pollId: string,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const row = (
    await db
      .select({ optionId: schema.pollVotes.optionId })
      .from(schema.pollVotes)
      .where(
        and(eq(schema.pollVotes.pollId, pollId), eq(schema.pollVotes.userId, userId)),
      )
      .limit(1)
  )[0];
  return row?.optionId ?? null;
}

export async function listActivePolls(streamId: string): Promise<Poll[]> {
  return (
    await db
      .select()
      .from(schema.polls)
      .where(and(eq(schema.polls.streamId, streamId), eq(schema.polls.isClosed, false)))
      .orderBy(desc(schema.polls.createdAt))
  ).map(toPoll);
}

export async function listPollsForStream(streamId: string): Promise<Poll[]> {
  return (
    await db
      .select()
      .from(schema.polls)
      .where(eq(schema.polls.streamId, streamId))
      .orderBy(desc(schema.polls.createdAt))
  ).map(toPoll);
}

export async function getPollById(id: string): Promise<Poll | null> {
  const row = (await db.select().from(schema.polls).where(eq(schema.polls.id, id)).limit(1))[0];
  return row ? toPoll(row) : null;
}

export async function createPoll(input: {
  streamId: string;
  question: string;
  options: { id: string; label: string }[];
  closesAt: string;
  whoCanVote?: "signed_in" | "subscribers";
  showResultsLive?: boolean;
  showWinnerOnStream?: boolean;
  allowVoteChange?: boolean;
}): Promise<Poll> {
  const id = shortId("poll");
  const createdAt = new Date().toISOString();
  const options: PollOption[] = input.options.map((o) => ({
    id: o.id,
    label: o.label,
    votes: 0,
  }));
  await db
    .insert(schema.polls)
    .values({
      id,
      streamId: input.streamId,
      question: input.question,
      options,
      createdAt,
      closesAt: input.closesAt,
      isClosed: false,
      totalVotes: 0,
      whoCanVote: input.whoCanVote ?? "signed_in",
      showResultsLive: input.showResultsLive ?? true,
      showWinnerOnStream: input.showWinnerOnStream ?? false,
      allowVoteChange: input.allowVoteChange ?? false,
    });
  const poll: Poll = {
    id,
    streamId: input.streamId,
    question: input.question,
    options,
    createdAt,
    closesAt: input.closesAt,
    isClosed: false,
    totalVotes: 0,
    whoCanVote: input.whoCanVote ?? "signed_in",
    showResultsLive: input.showResultsLive ?? true,
    showWinnerOnStream: input.showWinnerOnStream ?? false,
    allowVoteChange: input.allowVoteChange ?? false,
  };
  emit(`stream:${input.streamId}:polls`, { type: "created", poll });
  return poll;
}

/**
 * Cast or change a user's vote on a poll. PK is (userId, pollId) so each user
 * gets one active choice per poll; re-voting updates their pick and option counts.
 * Returns the updated poll, or null when the poll doesn't exist / is closed.
 */
export async function vote(input: {
  userId: string;
  pollId: string;
  optionId: string;
}): Promise<Poll | null> {
  const pollRow = (
    await db
      .select()
      .from(schema.polls)
      .where(eq(schema.polls.id, input.pollId))
      .limit(1)
  )[0];
  if (!pollRow) return null;
  if (pollRow.isClosed) return toPoll(pollRow);

  const optionExists = pollRow.options.some((o) => o.id === input.optionId);
  if (!optionExists) return toPoll(pollRow);

  const existing = (
    await db
      .select()
      .from(schema.pollVotes)
      .where(
        and(
          eq(schema.pollVotes.userId, input.userId),
          eq(schema.pollVotes.pollId, input.pollId)
        )
      )
      .limit(1)
  )[0];

  const now = new Date().toISOString();
  let nextOptions = pollRow.options.map((o) => ({ ...o }));
  let nextTotal = pollRow.totalVotes;

  if (existing) {
    if (existing.optionId === input.optionId) {
      // Idempotent: nothing to change.
      return toPoll(pollRow);
    }
    // Move vote: decrement old option, increment new.
    nextOptions = nextOptions.map((o) => {
      if (o.id === existing.optionId) return { ...o, votes: Math.max(0, o.votes - 1) };
      if (o.id === input.optionId) return { ...o, votes: o.votes + 1 };
      return o;
    });
    await db
      .update(schema.pollVotes)
      .set({ optionId: input.optionId, createdAt: now })
      .where(
        and(
          eq(schema.pollVotes.userId, input.userId),
          eq(schema.pollVotes.pollId, input.pollId)
        )
      );
  } else {
    nextOptions = nextOptions.map((o) =>
      o.id === input.optionId ? { ...o, votes: o.votes + 1 } : o
    );
    nextTotal += 1;
    await db
      .insert(schema.pollVotes)
      .values({
        userId: input.userId,
        pollId: input.pollId,
        optionId: input.optionId,
        createdAt: now,
      });
  }

  await db
    .update(schema.polls)
    .set({ options: nextOptions, totalVotes: nextTotal })
    .where(eq(schema.polls.id, input.pollId));

  const updated: Poll = {
    ...toPoll(pollRow),
    options: nextOptions,
    totalVotes: nextTotal,
  };
  emit(`stream:${pollRow.streamId}:polls`, { type: "results", poll: updated });
  return updated;
}

export async function closePoll(pollId: string): Promise<Poll | null> {
  const row = (await db.select().from(schema.polls).where(eq(schema.polls.id, pollId)).limit(1))[0];
  if (!row) return null;
  await db
    .update(schema.polls)
    .set({ isClosed: true })
    .where(eq(schema.polls.id, pollId));
  const closed: Poll = { ...toPoll(row), isClosed: true };
  emit(`stream:${row.streamId}:polls`, { type: "closed", poll: closed });

  /*
   * The result, on the picture, when the poll was set up to end that way.
   *
   * Sent as its own frame rather than left for the client to work out from the
   * closed poll: the winner is a moment with a start, and every viewer should
   * see it at the same time rather than whenever their next poll refresh lands.
   *
   * A tie is announced as a tie. Picking one of two equal answers to put on
   * screen would be inventing a result in front of the people who voted.
   */
  if (closed.showWinnerOnStream && closed.totalVotes > 0) {
    const ranked = [...closed.options].sort((a, b) => b.votes - a.votes);
    const top = ranked[0]!;
    const tied = ranked.filter((o) => o.votes === top.votes);
    emit(`stream:${row.streamId}:polls`, {
      type: "winner",
      pollId: closed.id,
      question: closed.question,
      totalVotes: closed.totalVotes,
      tie: tied.length > 1,
      // Every answer, in order, not only the winning one: a viewer should be
      // able to see where their own vote sat rather than only being told they
      // lost. The screen decides how many of them it has room for.
      winners: ranked.map((o) => ({
        label: o.label,
        votes: o.votes,
        percent: Math.round((o.votes / closed.totalVotes) * 100),
      })),
    });
  }

  return closed;
}
