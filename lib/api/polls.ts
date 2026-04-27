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
  };
}

export async function listActivePolls(streamId: string): Promise<Poll[]> {
  return db
    .select()
    .from(schema.polls)
    .where(and(eq(schema.polls.streamId, streamId), eq(schema.polls.isClosed, false)))
    .orderBy(desc(schema.polls.createdAt))
    .all()
    .map(toPoll);
}

export async function listPollsForStream(streamId: string): Promise<Poll[]> {
  return db
    .select()
    .from(schema.polls)
    .where(eq(schema.polls.streamId, streamId))
    .orderBy(desc(schema.polls.createdAt))
    .all()
    .map(toPoll);
}

export async function getPollById(id: string): Promise<Poll | null> {
  const row = db.select().from(schema.polls).where(eq(schema.polls.id, id)).get();
  return row ? toPoll(row) : null;
}

export async function createPoll(input: {
  streamId: string;
  question: string;
  options: { id: string; label: string }[];
  closesAt: string;
}): Promise<Poll> {
  const id = shortId("poll");
  const createdAt = new Date().toISOString();
  const options: PollOption[] = input.options.map((o) => ({
    id: o.id,
    label: o.label,
    votes: 0,
  }));
  db.insert(schema.polls)
    .values({
      id,
      streamId: input.streamId,
      question: input.question,
      options,
      createdAt,
      closesAt: input.closesAt,
      isClosed: false,
      totalVotes: 0,
    })
    .run();
  const poll: Poll = {
    id,
    streamId: input.streamId,
    question: input.question,
    options,
    createdAt,
    closesAt: input.closesAt,
    isClosed: false,
    totalVotes: 0,
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
  const pollRow = db
    .select()
    .from(schema.polls)
    .where(eq(schema.polls.id, input.pollId))
    .get();
  if (!pollRow) return null;
  if (pollRow.isClosed) return toPoll(pollRow);

  const optionExists = pollRow.options.some((o) => o.id === input.optionId);
  if (!optionExists) return toPoll(pollRow);

  const existing = db
    .select()
    .from(schema.pollVotes)
    .where(
      and(
        eq(schema.pollVotes.userId, input.userId),
        eq(schema.pollVotes.pollId, input.pollId)
      )
    )
    .get();

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
    db.update(schema.pollVotes)
      .set({ optionId: input.optionId, createdAt: now })
      .where(
        and(
          eq(schema.pollVotes.userId, input.userId),
          eq(schema.pollVotes.pollId, input.pollId)
        )
      )
      .run();
  } else {
    nextOptions = nextOptions.map((o) =>
      o.id === input.optionId ? { ...o, votes: o.votes + 1 } : o
    );
    nextTotal += 1;
    db.insert(schema.pollVotes)
      .values({
        userId: input.userId,
        pollId: input.pollId,
        optionId: input.optionId,
        createdAt: now,
      })
      .run();
  }

  db.update(schema.polls)
    .set({ options: nextOptions, totalVotes: nextTotal })
    .where(eq(schema.polls.id, input.pollId))
    .run();

  const updated: Poll = {
    ...toPoll(pollRow),
    options: nextOptions,
    totalVotes: nextTotal,
  };
  emit(`stream:${pollRow.streamId}:polls`, { type: "results", poll: updated });
  return updated;
}

export async function closePoll(pollId: string): Promise<Poll | null> {
  const row = db.select().from(schema.polls).where(eq(schema.polls.id, pollId)).get();
  if (!row) return null;
  db.update(schema.polls)
    .set({ isClosed: true })
    .where(eq(schema.polls.id, pollId))
    .run();
  const closed: Poll = { ...toPoll(row), isClosed: true };
  emit(`stream:${row.streamId}:polls`, { type: "closed", poll: closed });
  return closed;
}
