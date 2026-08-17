"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
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
    };
    void (async () => {
      try {
        await adminCreatePoll(payload.streamId, {
          question: payload.question,
          options: payload.options,
          durationMinutes: payload.durationMinutes,
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
  }) => void;
}) {
  const [streamId, setStreamId] = React.useState(streams[0]?.id ?? "");
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState<string[]>(["", ""]);
  const [duration, setDuration] = React.useState("5");

  React.useEffect(() => {
    if (open) {
      setStreamId(streams[0]?.id ?? "");
      setQuestion("");
      setOptions(["", ""]);
      setDuration("5");
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
