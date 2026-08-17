"use client";

import * as React from "react";
import Link from "next/link";
import { Gauge, X } from "@/components/icons";
import { useLiteMode } from "@/lib/client/player-features";

/**
 * Thin banner that renders only when Lite mode is enabled.
 * Mount inside the app shell (e.g. above <TopNav /> or just below it) so it persists across
 * authenticated routes.
 *
 * Suggested mount point: `app/(authed)/layout.tsx` or `app/(public)/layout.tsx` - top of <main>.
 * Stays out of admin routes by default unless the admin layout opts in.
 */
export function LiteModeBanner() {
  const [enabled, setEnabled] = useLiteMode();
  const [dismissed, setDismissed] = React.useState(false);

  if (!enabled || dismissed) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-secondary"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5 text-xs">
        <Gauge className="size-3.5 shrink-0 text-amber-300" aria-hidden />
        <span className="flex-1 truncate text-foreground/80">
          <span className="font-semibold text-foreground">Lite mode is active</span>
          <span className="hidden sm:inline">
            {" "}
            - quality capped at 360p, thumbnails dimmed.
          </span>
        </span>
        <Link
          href="/settings?tab=playback"
          className="hidden text-foreground/80 underline-offset-2 hover:text-foreground hover:underline sm:inline"
        >
          Change
        </Link>
        <button
          type="button"
          onClick={() => setEnabled(false)}
          className="rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Turn off
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
