import type { Poll } from "@/lib/types";
import { sleep, hoursAgo, minutesAgo } from "./_util";

export const polls: Poll[] = [
  {
    id: "poll_1",
    streamId: "stream_lagos_final",
    question: "Who takes Map 4?",
    options: [
      { id: "alpha", label: "Team Alpha", votes: 482 },
      { id: "nova", label: "Nova Esports", votes: 311 },
    ],
    createdAt: minutesAgo(4),
    closesAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    isClosed: false,
    totalVotes: 793,
  },
  {
    id: "poll_closed_1",
    streamId: "stream_lagos_final",
    question: "MVP of Map 2?",
    options: [
      { id: "viper", label: "Viper (ALPHA)", votes: 612 },
      { id: "shadow", label: "Shadow (NOVA)", votes: 184 },
      { id: "blaze", label: "Blaze (ALPHA)", votes: 209 },
    ],
    createdAt: hoursAgo(1),
    closesAt: hoursAgo(1),
    isClosed: true,
    totalVotes: 1005,
  },
];

export async function listActivePolls(streamId: string): Promise<Poll[]> {
  await sleep(60);
  return polls.filter((p) => p.streamId === streamId && !p.isClosed);
}

export async function listPollsForStream(streamId: string): Promise<Poll[]> {
  await sleep();
  return polls.filter((p) => p.streamId === streamId);
}

export async function votePoll(pollId: string, optionId: string): Promise<Poll | null> {
  await sleep(150);
  const poll = polls.find((p) => p.id === pollId);
  if (!poll || poll.isClosed) return null;
  const opt = poll.options.find((o) => o.id === optionId);
  if (!opt) return null;
  opt.votes += 1;
  poll.totalVotes += 1;
  return poll;
}
