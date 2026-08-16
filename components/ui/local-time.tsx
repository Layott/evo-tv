"use client";

import * as React from "react";

/**
 * A schedule time in the viewer's own clock.
 *
 * The channel runs on Lagos time and the grid is stored that way, which is
 * right: a channel has one clock. What was wrong was showing that clock to
 * everybody, so a viewer in London read 20:00 and turned up an hour late.
 *
 * The time zone comes from the browser, not from an IP address. It is exact,
 * it costs nothing, and it needs no permission.
 *
 * Server-rendered output stays on channel time so the markup matches on both
 * sides and there is no hydration mismatch; the swap happens on the first
 * client render.
 */

const CHANNEL_TZ = "Africa/Lagos";

function format(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function LocalTime({
  iso,
  className,
  /** Adds the channel's own time after the local one, for the schedule grid. */
  showChannelTime = false,
}: {
  iso: string;
  className?: string;
  showChannelTime?: boolean;
}) {
  const [tz, setTz] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    } catch {
      setTz(null);
    }
  }, []);

  const channel = format(iso, CHANNEL_TZ);
  if (!tz || tz === CHANNEL_TZ) {
    return <span className={className}>{channel}</span>;
  }

  const local = format(iso, tz);
  if (local === channel) return <span className={className}>{channel}</span>;

  return (
    <span className={className} title={`${channel} in Lagos, the channel's clock`}>
      {local}
      {showChannelTime ? (
        <span className="ml-1 text-[0.85em] opacity-60">({channel} WAT)</span>
      ) : null}
    </span>
  );
}
