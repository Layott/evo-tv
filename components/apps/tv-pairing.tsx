"use client";

import * as React from "react";
import { Check, Loader2, RotateCw, Tv } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startTvPairing, pollPairing } from "@/lib/mock/apps";

type State =
  | { status: "idle" }
  | { status: "pending"; code: string }
  | { status: "paired"; code: string };

export function TvPairing() {
  const [state, setState] = React.useState<State>({ status: "idle" });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (state.status !== "pending") return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const { status } = await pollPairing(state.code);
        if (cancelled) return;
        if (status === "paired") {
          setState({ status: "paired", code: state.code });
          toast.success("Paired!", {
            description: "Your TV is now linked to your EVO TV account.",
          });
        }
      } catch {
        /* noop */
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [state]);

  async function startPair() {
    if (loading) return;
    setLoading(true);
    try {
      const { code } = await startTvPairing();
      setState({ status: "pending", code });
      toast.message("Pairing code generated", {
        description: "Enter it on your TV within 5 minutes.",
      });
    } catch {
      toast.error("Couldn't start pairing");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  if (state.status === "paired") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="size-6 text-emerald-300" />
        </div>
        <h3 className="mt-3 text-lg font-semibold text-emerald-200">Paired</h3>
        <p className="mt-1 text-sm text-emerald-300/80">
          Code <span className="font-mono font-bold">{state.code}</span> linked to your account.
        </p>
        <Button
          variant="outline"
          className="mt-4 border-emerald-500/40 bg-transparent text-emerald-200 hover:bg-emerald-500/10"
          onClick={reset}
        >
          <RotateCw className="size-4" />
          Pair another TV
        </Button>
      </div>
    );
  }

  if (state.status === "pending") {
    const chars = state.code.split("");
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-neutral-400">
          <Tv className="size-3.5" /> Open the EVO TV app on your TV and enter:
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {chars.map((c, i) => (
            <div
              key={i}
              className="flex h-14 w-12 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-950/60 font-mono text-3xl font-bold tracking-widest text-sky-300 shadow-inner sm:h-16 sm:w-14"
            >
              {c}
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-400">
          <Loader2 className="size-3.5 animate-spin" />
          Waiting for your TV to confirm…
        </p>
        <Button variant="ghost" size="sm" onClick={reset} className="mt-3 text-neutral-400">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/15">
        <Tv className="size-6 text-sky-300" />
      </div>
      <h3 className="mt-3 text-lg font-semibold text-neutral-100">Pair your TV</h3>
      <p className="mt-1 text-sm text-neutral-400">
        We'll generate a 6-character code. Enter it on the EVO TV app on your TV to link this account.
      </p>
      <Button
        onClick={startPair}
        disabled={loading}
        className="mt-4 bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating code…
          </>
        ) : (
          "Generate pairing code"
        )}
      </Button>
    </div>
  );
}
