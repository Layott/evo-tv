"use client";

import * as React from "react";

/**
 * The poll result, on the picture, for everybody at once.
 *
 * The owner's ask was "an option where the winner gets shown on live, something
 * users can interact with and see themselves live due to the poll". The voting
 * happens in the panel beside the video; this is the half that makes it an
 * event: the moment the poll closes the answer takes the screen, and every
 * viewer sees it at the same second because it arrives as its own frame on the
 * connection the page already holds open.
 *
 * A tie is announced as a tie. Choosing one of two equal answers to display
 * would be inventing a result in front of the people who voted for the other.
 */

interface WinnerFrame {
  type: "winner";
  pollId: string;
  question: string;
  totalVotes: number;
  tie: boolean;
  winners: { label: string; votes: number; percent: number }[];
}

const HOLD_MS = 9_000;

export function PollResultOverlay({ streamId }: { streamId: string }) {
  const [frame, setFrame] = React.useState<WinnerFrame | null>(null);

  React.useEffect(() => {
    if (!streamId || typeof EventSource === "undefined") return;
    const source = new EventSource(`/api/sse/stream/${encodeURIComponent(streamId)}`);
    let hide: ReturnType<typeof setTimeout> | null = null;

    const onPolls = (event: MessageEvent) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      const data = payload as WinnerFrame;
      if (data?.type !== "winner" || !data.winners?.length) return;
      setFrame(data);
      if (hide) clearTimeout(hide);
      hide = setTimeout(() => setFrame(null), HOLD_MS);
    };

    source.addEventListener("polls", onPolls);
    source.addEventListener("error", () => {});
    return () => {
      if (hide) clearTimeout(hide);
      source.removeEventListener("polls", onPolls);
      source.close();
    };
  }, [streamId]);

  if (!frame) return null;

  const top = frame.winners[0]!;

  return (
    <div className="ovl-fs pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/95 px-10 text-center">
      <p className="ovl-letters text-[0.7rem] uppercase text-[var(--brand,#46e3ce)]">
        {frame.tie ? "It is a tie" : "The room has decided"}
      </p>
      <p className="max-w-[40ch] text-sm text-white/60">{frame.question}</p>
      <p className="ovl-mask text-5xl font-black leading-none tracking-tight text-white">
        {frame.tie
          ? frame.winners
              .filter((w) => w.votes === top.votes)
              .map((w) => w.label)
              .join(" · ")
          : top.label}
      </p>
      <p className="text-xl font-semibold tabular-nums" style={{ color: "#ffd84d" }}>
        {top.percent}%
        <span className="ml-2 text-sm font-normal text-white/50">
          of {frame.totalVotes} vote{frame.totalVotes === 1 ? "" : "s"}
        </span>
      </p>

      {/* The rest of the answers, so a viewer can see where their own vote sat
          rather than only being told they lost. */}
      {!frame.tie && frame.winners.length > 1 ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {frame.winners.slice(1, 4).map((w) => (
            <span
              key={w.label}
              className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70"
            >
              {w.label} {w.percent}%
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
