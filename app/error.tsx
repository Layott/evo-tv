"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-xl font-black text-neutral-950">
            !
          </div>
        </div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-rose-400">
          500 · Something broke
        </div>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          We dropped a frame
        </h1>
        <p className="mb-8 text-sm text-neutral-400">
          {error.message || "An unexpected error occurred. Retrying usually fixes it."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-neutral-950 hover:bg-sky-400"
          >
            Try again
          </button>
          <Link
            href="/home"
            className="rounded-full border border-neutral-700 px-5 py-2 text-sm text-neutral-200 hover:border-neutral-500"
          >
            Go home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[10px] uppercase tracking-wider text-neutral-600">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
