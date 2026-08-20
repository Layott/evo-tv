"use client";

import * as React from "react";
import { Plus, X } from "@/components/icons";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminClosePoll,
  adminCreatePoll,
  adminListPolls,
  adminListStreams,
} from "@/lib/client";
import type { Poll, Stream } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTable, type DataColumn } from "./data-table";
import { PageHeader } from "./page-header";
import { HowTo } from "./how-to";
import { StatusBadge } from "./status-badge";
import { formatNumber, timeAgo } from "./utils";

function streamTitle(streams: Stream[], id: string) {
  return streams.find((s) => s.id === id)?.title ?? id;
}

export function PollsManagerPage() {
  const queryClient = useQueryClient();
  const pollsQ = useQuery({ queryKey: ["admin", "polls"], queryFn: () => adminListPolls() });
  const streamsQ = useQuery({
    queryKey: ["admin", "streams-all"],
    queryFn: () => adminListStreams({ limit: 200 }),
  });
  const all = pollsQ.data ?? [];
  const streams = streamsQ.data?.streams ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "polls"] });
  const [openCreate, setOpenCreate] = React.useState(false);
  const [selected, setSelected] = React.useState<Poll | null>(null);

  const columns: DataColumn<Poll>[] = [
    {
      key: "question",
      header: "Question",
      sortable: true,
      accessor: (r) => r.question,
      cell: (row) => (
        <div>
          <div className="text-sm font-medium text-foreground">{row.question}</div>
          <div className="text-xs text-muted-foreground">{row.options.length} options</div>
        </div>
      ),
    },
    {
      key: "stream",
      header: "Stream",
      cell: (row) => <span className="text-sm text-foreground/80">{streamTitle(streams, row.streamId)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => (r.isClosed ? 0 : 1),
      cell: (row) =>
        row.isClosed ? (
          <StatusBadge tone="neutral">Closed</StatusBadge>
        ) : (
          <StatusBadge tone="emerald" dot>
            Active
          </StatusBadge>
        ),
    },
    {
      key: "votes",
      header: "Votes",
      sortable: true,
      accessor: (r) => r.totalVotes,
      cell: (row) => <span className="tabular-nums text-sm">{formatNumber(row.totalVotes)}</span>,
      className: "text-right",
    },
    {
      key: "closes",
      header: "Closes",
      sortable: true,
      accessor: (r) => new Date(r.closesAt).getTime(),
      cell: (row) => <span className="text-xs text-muted-foreground">{timeAgo(row.closesAt)}</span>,
    },
  ];

  function handleCreate(payload: {
    streamId: string;
    question: string;
    options: string[];
    durationMinutes: number;
    whoCanVote: "signed_in" | "subscribers";
    showResultsLive: boolean;
    showWinnerOnStream: boolean;
    allowVoteChange: boolean;
  }) {
    const poll: Poll = {
      id: `poll_new_${Date.now()}`,
      streamId: payload.streamId,
      question: payload.question,
      options: payload.options.map((label, i) => ({
        id: `opt_${i}`,
        label,
        votes: 0,
      })),
      createdAt: new Date().toISOString(),
      closesAt: new Date(Date.now() + payload.durationMinutes * 60_000).toISOString(),
      isClosed: false,
      totalVotes: 0,
      whoCanVote: payload.whoCanVote,
      showResultsLive: payload.showResultsLive,
      showWinnerOnStream: payload.showWinnerOnStream,
      allowVoteChange: payload.allowVoteChange,
    };
    void (async () => {
      try {
        await adminCreatePoll(payload.streamId, {
          question: payload.question,
          options: payload.options,
          durationMinutes: payload.durationMinutes,
          whoCanVote: payload.whoCanVote,
          showResultsLive: payload.showResultsLive,
          showWinnerOnStream: payload.showWinnerOnStream,
          allowVoteChange: payload.allowVoteChange,
        });
        toast.success("Poll created");
        setOpenCreate(false);
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create the poll");
      }
    })();
  }

  function handleClose(id: string) {
    void (async () => {
      try {
        await adminClosePoll(id);
        setSelected((prev) => (prev && prev.id === id ? { ...prev, isClosed: true } : prev));
        toast.success("Poll closed");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not close the poll");
      }
    })();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polls"
        description="Create live polls, track engagement, close when finished."
        actions={
          <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4" />
      <HowTo page="polls" />
            New poll
          </Button>
        }
      />

      <DataTable<Poll>
        data={all}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.question}</SheetTitle>
                <SheetDescription>
                  {streamTitle(streams, selected.streamId)} · {formatNumber(selected.totalVotes)} votes ·{" "}
                  {selected.isClosed ? "closed" : `closes ${timeAgo(selected.closesAt)}`}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4">
                <div className="h-64 rounded-lg border border-border bg-card/40 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selected.options.map((o) => ({ label: o.label, votes: o.votes }))}>
                      <CartesianGrid stroke="#262626" vertical={false} />
                      <XAxis dataKey="label" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: "#171717" }}
                        contentStyle={{
                          backgroundColor: "#171717",
                          border: "1px solid #262626",
                          borderRadius: 8,
                          color: "#e5e5e5",
                        }}
                      />
                      <Bar dataKey="votes" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <ul className="mt-4 space-y-2">
                  {selected.options.map((o) => {
                    const pct =
                      selected.totalVotes > 0 ? Math.round((o.votes / selected.totalVotes) * 100) : 0;
                    return (
                      <li key={o.id} className="rounded-md border border-border bg-card/40 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{o.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatNumber(o.votes)} · {pct}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <PollMetrics poll={selected} />

              <SheetFooter>
                {selected.isClosed ? (
                  <Button disabled className="bg-muted">
                    Poll closed
                  </Button>
                ) : (
                  <Button
                    className="bg-red-600 text-white hover:bg-red-500"
                    onClick={() => handleClose(selected.id)}
                  >
                    Close poll
                  </Button>
                )}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <CreatePollDrawer
        streams={streams}
        open={openCreate}
        onOpenChange={setOpenCreate}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function CreatePollDrawer({
  streams,
  open,
  onOpenChange,
  onSubmit,
}: {
  streams: Stream[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: {
    streamId: string;
    question: string;
    options: string[];
    durationMinutes: number;
    whoCanVote: "signed_in" | "subscribers";
    showResultsLive: boolean;
    showWinnerOnStream: boolean;
    allowVoteChange: boolean;
  }) => void;
}) {
  const [streamId, setStreamId] = React.useState(streams[0]?.id ?? "");
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState<string[]>(["", ""]);
  const [duration, setDuration] = React.useState("5");
  const [whoCanVote, setWhoCanVote] = React.useState<"signed_in" | "subscribers">("signed_in");
  const [showResultsLive, setShowResultsLive] = React.useState(true);
  const [showWinnerOnStream, setShowWinnerOnStream] = React.useState(false);
  const [allowVoteChange, setAllowVoteChange] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStreamId(streams[0]?.id ?? "");
      setQuestion("");
      setOptions(["", ""]);
      setDuration("5");
      setWhoCanVote("signed_in");
      setShowResultsLive(true);
      setShowWinnerOnStream(false);
      setAllowVoteChange(false);
    }
  }, [open]);

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const disabled = !streamId || !question.trim() || validOptions.length < 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New poll</SheetTitle>
          <SheetDescription>Create a live poll attached to a stream. 2-6 options.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label>Stream</Label>
            <Select value={streamId} onValueChange={setStreamId}>
              <SelectTrigger className="w-full border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {streams.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Who takes Map 4?"
              className="border-border bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Options</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="border-border bg-card"
                />
                {options.length > 2 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-border bg-card hover:bg-accent"
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
            {options.length < 6 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border bg-card hover:bg-accent"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add option
              </Button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-full border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "10", "15", "30"].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            How the poll behaves, per poll.
            
            "Who takes Map 4" and "which show should we renew" are not the same
            event and should not run under the same rules. A poll used to have a
            question, options and a clock, so it could only ever be the first
            kind.
          */}
          <div className="space-y-1.5">
            <Label>Who can vote</Label>
            <Select
              value={whoCanVote}
              onValueChange={(v) => setWhoCanVote(v as "signed_in" | "subscribers")}
            >
              <SelectTrigger className="w-full border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signed_in">Anyone with an account</SelectItem>
                <SelectItem value="subscribers">Subscribers only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              An account is the floor. A vote nobody can be identified for can be
              cast a thousand times from one browser.
            </p>
          </div>

          <div className="space-y-3 rounded-lg bg-card/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Show the totals while it runs
                </div>
                <div className="text-xs text-muted-foreground">
                  Off holds them back until it closes, so nobody votes with the
                  crowd and the close is the moment.
                </div>
              </div>
              <Switch checked={showResultsLive} onCheckedChange={setShowResultsLive} />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Put the winner on screen
                </div>
                <div className="text-xs text-muted-foreground">
                  When it closes, the result takes the picture for a few seconds.
                </div>
              </div>
              <Switch
                checked={showWinnerOnStream}
                onCheckedChange={setShowWinnerOnStream}
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Let people change their mind
                </div>
                <div className="text-xs text-muted-foreground">
                  Off means one vote each, decided the first time.
                </div>
              </div>
              <Switch checked={allowVoteChange} onCheckedChange={setAllowVoteChange} />
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            className="bg-card hover:bg-accent"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-sky-600 text-white hover:bg-sky-500"
            disabled={disabled}
            onClick={() =>
              onSubmit({
                streamId,
                question: question.trim(),
                options: validOptions,
                durationMinutes: Number(duration),
                whoCanVote,
                showResultsLive,
                showWinnerOnStream,
                allowVoteChange,
              })
            }
          >
            Launch poll
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * How the poll is going, while it is going.
 *
 * The panel showed a total and nothing else, so the person running the
 * broadcast could not answer either question that matters in the moment: is
 * anybody still voting, and is it close. Both come off `poll_votes`, which has
 * carried a timestamp since the table was created and had nothing reading it.
 *
 * Refreshed every five seconds while the poll is open and once when it is not.
 * A live number that is thirty seconds stale is worse than no number, because it
 * gets acted on.
 */
function PollMetrics({ poll }: { poll: Poll }) {
  const metricsQ = useQuery({
    queryKey: ["admin", "poll-metrics", poll.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/polls/${encodeURIComponent(poll.id)}/metrics`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not read the poll metrics");
      return (await res.json()) as {
        totalVotes: number;
        lastMinute: number;
        perMinute: number[];
        options: { id: string; label: string; votes: number; percent: number }[];
      };
    },
    refetchInterval: poll.isClosed ? false : 5_000,
  });

  const data = metricsQ.data;
  if (!data) return null;

  const peak = Math.max(1, ...data.perMinute);

  return (
    <div className="mt-6 space-y-3 rounded-xl bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {poll.isClosed ? "How it went" : "Live"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatNumber(data.totalVotes)} vote{data.totalVotes === 1 ? "" : "s"}
          {poll.isClosed ? "" : ` · ${data.lastMinute} in the last minute`}
        </p>
      </div>

      {/* Votes per minute since it opened, zero-filled: a gap in the middle is
          the moment the question stopped being interesting, and a chart that
          skips empty minutes hides exactly that. */}
      <div className="flex h-16 items-end gap-[2px]">
        {data.perMinute.map((count, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-sky-500/70"
            style={{ height: `${Math.max(2, (count / peak) * 100)}%` }}
            title={`${count} in minute ${i + 1}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Votes per minute since it opened
      </p>
    </div>
  );
}
