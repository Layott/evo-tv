"use client";

import Link from "next/link";
import { useEffect } from "react";

import { isChunkError, reloadOnce } from "@/components/providers/stale-build-guard";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /*
     * A chunk that no longer exists is not an error worth showing anybody.
     *
     * It means this tab was open when a deploy landed, so the page is asking
     * for files from a build that is gone. "We dropped a frame" is a bad answer
     * to that: nothing is wrong with the site, the tab is simply out of date,
     * and one reload fixes it. `reloadOnce` carries the cooldown that stops
     * this becoming a loop if the new build is broken too.
     */
    if (isChunkError(error)) {
      reloadOnce();
      return;
    }
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500 text-xl font-black text-ink">
            !
          </div>
        </div>
        <div className="mb-2 text-[11px] font-semibold text-rose-400">
          500 · Something broke
        </div>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          We dropped a frame
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred. Retrying usually fixes it."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-ink hover:bg-sky-400"
          >
            Try again
          </button>
          <Link
            href="/home"
            className="rounded-full  px-5 py-2 text-sm text-foreground hover:bg-card"
          >
            Go home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[10px] text-muted-foreground">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
