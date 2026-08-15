"use client";

import * as React from "react";

interface CountdownTimerProps {
  target: string;
  className?: string;
  label?: string;
}

function diff(targetMs: number) {
  const now = Date.now();
  const ms = Math.max(0, targetMs - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: ms === 0 };
}

export function CountdownTimer({ target, className, label }: CountdownTimerProps) {
  const targetMs = React.useMemo(() => new Date(target).getTime(), [target]);
  const [t, setT] = React.useState(() => diff(targetMs));

  React.useEffect(() => {
    const id = setInterval(() => setT(diff(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className={className}>
      {label && <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>}
      <div className="flex gap-2 sm:gap-3">
        {[
          { label: "Days", value: t.days },
          { label: "Hrs", value: t.hours },
          { label: "Min", value: t.minutes },
          { label: "Sec", value: t.seconds },
        ].map((u) => (
          <div
            key={u.label}
            className="flex min-w-[54px] flex-col items-center rounded-lg border border-border bg-card/60 px-3 py-2"
          >
            <span className="text-2xl font-bold tabular-nums text-sky-400">
              {pad(u.value)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {u.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CountdownTimer;
