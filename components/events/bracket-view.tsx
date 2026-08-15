"use client";

import type { Match, Team } from "@/lib/types";

interface BracketViewProps {
  matches: Match[];
  teams: Map<string, Team>;
}

function MatchCard({ match, teams }: { match: Match; teams: Map<string, Team> }) {
  const a = teams.get(match.teamAId);
  const b = teams.get(match.teamBId);
  const completed = match.state === "completed";
  const aWin = completed && match.scoreA > match.scoreB;
  const bWin = completed && match.scoreB > match.scoreA;

  return (
    <div className="w-64 shrink-0 overflow-hidden rounded-xl border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Bo{match.bestOf}</span>
        {match.state === "live" && (
          <span className="flex items-center gap-1 text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
          </span>
        )}
        {match.state === "scheduled" && (
          <span>{new Date(match.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        )}
        {completed && <span>Final</span>}
      </div>
      <div className="divide-y divide-border">
        <Row team={a} score={match.scoreA} win={aWin} played={completed || match.state === "live"} />
        <Row team={b} score={match.scoreB} win={bWin} played={completed || match.state === "live"} />
      </div>
    </div>
  );
}

function Row({ team, score, win, played }: { team: Team | undefined; score: number; win: boolean; played: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 text-sm ${
        win ? "bg-sky-500/5 text-sky-300" : "text-foreground"
      }`}
    >
      {team ? (
        <>
          <img src={team.logoUrl} alt={team.tag} className="h-6 w-6 rounded border border-border" />
          <span className="truncate font-medium">{team.name}</span>
          <span className="ml-auto tabular-nums text-xs text-muted-foreground">{team.tag}</span>
          <span className={`ml-2 w-6 text-right font-bold tabular-nums ${win ? "text-sky-300" : played ? "text-foreground" : "text-muted-foreground"}`}>
            {played ? score : "-"}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">TBD</span>
      )}
    </div>
  );
}

export function BracketView({ matches, teams }: BracketViewProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
        Bracket TBD
      </div>
    );
  }

  // Group by round, preserving order of first appearance.
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    if (!groups.has(m.round)) groups.set(m.round, []);
    groups.get(m.round)!.push(m);
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex min-w-max gap-6">
        {Array.from(groups.entries()).map(([round, ms]) => (
          <div key={round} className="flex min-w-[16rem] flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              {round}
            </h3>
            <div className="flex flex-col gap-3">
              {ms.map((m) => (
                <MatchCard key={m.id} match={m} teams={teams} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BracketView;
