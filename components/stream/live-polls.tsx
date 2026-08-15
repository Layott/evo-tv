"use client";

import * as React from "react";
import type { Poll } from "@/lib/types";
import { listActivePolls, listPollsForStream, votePoll } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Vote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface State {
  active: Poll[];
  all: Poll[];
}

export function LivePolls({ streamId }: { streamId: string }) {
  const [state, setState] = React.useState<State>({ active: [], all: [] });
  const [voted, setVoted] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([listActivePolls(streamId), listPollsForStream(streamId)]).then(
      ([active, all]) => {
        if (!cancelled) {
          setState({ active, all });
          setLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  const handleVote = async (poll: Poll, optionId: string) => {
    if (voted[poll.id]) return;
    // optimistic
    setVoted((prev) => ({ ...prev, [poll.id]: optionId }));
    setState((prev) => {
      const next = { ...prev };
      next.active = next.active.map((p) =>
        p.id === poll.id
          ? {
              ...p,
              totalVotes: p.totalVotes + 1,
              options: p.options.map((o) =>
                o.id === optionId ? { ...o, votes: o.votes + 1 } : o
              ),
            }
          : p
      );
      next.all = next.all.map((p) =>
        p.id === poll.id
          ? {
              ...p,
              totalVotes: p.totalVotes + 1,
              options: p.options.map((o) =>
                o.id === optionId ? { ...o, votes: o.votes + 1 } : o
              ),
            }
          : p
      );
      return next;
    });
    await votePoll(poll.id, optionId);
    toast.success("Vote cast");
  };

  const closedPolls = state.all.filter((p) => p.isClosed);
  const activePolls = state.active;

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        <div className="h-20 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (activePolls.length === 0 && closedPolls.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Vote className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground/80">No active polls</p>
        <p className="text-xs text-muted-foreground">
          Casters will open polls during key moments.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      {activePolls.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          votedOption={voted[poll.id]}
          onVote={handleVote}
        />
      ))}
      {closedPolls.length > 0 && (
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Recent polls
          </h4>
          <div className="space-y-3">
            {closedPolls.map((p) => (
              <PollCard key={p.id} poll={p} votedOption={undefined} onVote={() => {}} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PollCard({
  poll,
  votedOption,
  onVote,
}: {
  poll: Poll;
  votedOption: string | undefined;
  onVote: (poll: Poll, optionId: string) => void;
}) {
  const total = Math.max(1, poll.totalVotes);
  const showResults = poll.isClosed || Boolean(votedOption);

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{poll.question}</h3>
        {poll.isClosed ? (
          <Badge variant="secondary" className="text-[10px]">
            Closed
          </Badge>
        ) : (
          <Badge className="bg-sky-500/20 text-sky-300 text-[10px]">
            Live
          </Badge>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {poll.options.map((opt) => {
          const pct = Math.round((opt.votes / total) * 100);
          const selected = votedOption === opt.id;
          return (
            <div key={opt.id} className="space-y-1">
              {showResults ? (
                <div
                  className={cn(
                    "rounded-md border border-border px-2.5 py-1.5",
                    selected && "border-sky-500/50 bg-sky-500/5"
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground flex items-center gap-1">
                      {selected && (
                        <CheckCircle2 className="size-3 text-sky-400" />
                      )}
                      {opt.label}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {pct}% · {opt.votes.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={pct} className="mt-1 h-1.5" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between border-input hover:border-sky-500/50 hover:bg-sky-500/5"
                  onClick={() => onVote(poll, opt.id)}
                >
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground">Vote</span>
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        {poll.totalVotes.toLocaleString()} votes
      </div>
    </div>
  );
}
