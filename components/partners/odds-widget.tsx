"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeInfo, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listOddsForStream, type MatchOdds } from "@/lib/mock/partners";

interface OddsWidgetProps {
  streamId: string;
}

export function OddsWidget({ streamId }: OddsWidgetProps) {
  const [data, setData] = React.useState<{
    matchId: string;
    matchLabel: string;
    odds: MatchOdds[];
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listOddsForStream(streamId).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  function visit(partnerName: string) {
    toast.message(
      `${partnerName} — opening partner page (showcase only, EVO TV does not place wagers).`,
    );
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="border-b border-neutral-800 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Live odds</h3>
            <p className="text-[11px] text-neutral-500">
              {data?.matchLabel ?? "Loading match…"}
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            <Clock className="size-2.5 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {data === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-neutral-500" />
          </div>
        ) : data.odds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
            No odds available for this match.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.odds.map((o) => {
              const teamA = data.matchLabel.split(" vs ")[0]?.trim() ?? "Team A";
              const teamB = data.matchLabel.split(" vs ")[1]?.trim() ?? "Team B";
              return (
                <li
                  key={o.partnerId}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 transition hover:border-neutral-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-neutral-100">
                      {o.partnerName}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {o.marketLabel}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <OddsTile
                      label={teamA}
                      odds={o.oddsTeamA}
                      onClick={() => visit(o.partnerName)}
                    />
                    {typeof o.oddsDraw === "number" ? (
                      <OddsTile
                        label="Draw"
                        odds={o.oddsDraw}
                        onClick={() => visit(o.partnerName)}
                      />
                    ) : (
                      <OddsTile
                        label="2-way"
                        odds={(o.oddsTeamA + o.oddsTeamB) / 2}
                        muted
                        onClick={() => visit(o.partnerName)}
                      />
                    )}
                    <OddsTile
                      label={teamB}
                      odds={o.oddsTeamB}
                      onClick={() => visit(o.partnerName)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => visit(o.partnerName)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-neutral-800 bg-neutral-950/60 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-neutral-900"
                  >
                    View on {o.partnerName}
                    <ArrowUpRight className="size-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-start gap-2 border-t border-neutral-800 bg-neutral-950 px-3 py-2.5 text-[11px] text-neutral-400">
        <BadgeInfo className="mt-0.5 size-3 shrink-0 text-neutral-500" />
        <span>
          Odds shown for entertainment only. EVO TV does not facilitate wagers.{" "}
          <Link href="/partners" className="text-sky-400 hover:underline">
            See all partners
          </Link>
        </span>
      </div>
    </div>
  );
}

function OddsTile({
  label,
  odds,
  onClick,
  muted,
}: {
  label: string;
  odds: number;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-lg border px-1 py-2 transition ${
        muted
          ? "border-neutral-800 bg-neutral-900/30 text-neutral-500 hover:border-neutral-700"
          : "border-neutral-800 bg-neutral-950/80 text-neutral-100 hover:border-sky-500/50 hover:bg-neutral-900"
      }`}
    >
      <span className="max-w-full truncate text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <span className="mt-0.5 font-semibold tabular-nums">
        {odds.toFixed(2)}
      </span>
    </button>
  );
}
