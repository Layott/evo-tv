"use client";

import * as React from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** Friendly platform name used in the success message. */
  platformLabel: string;
  className?: string;
}

export function NotifyForm({ platformLabel, className }: Props) {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    setDone(true);
    toast.success("You're on the list", {
      description: `We'll email you the moment ${platformLabel} ships.`,
    });
  }

  if (done) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-200 ${className ?? ""}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="size-4" />
        </span>
        <div>
          <div className="font-semibold">You're on the list.</div>
          <div className="text-xs text-emerald-300/80">
            We'll email <span className="font-semibold">{email}</span> when {platformLabel} ships.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 ${className ?? ""}`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm text-neutral-200">
        <Bell className="size-4 text-sky-400" />
        Notify me when {platformLabel} ships
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="bg-neutral-950/60"
        />
        <Button
          type="submit"
          disabled={submitting}
          className="bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400 sm:w-44"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Subscribing…
            </>
          ) : (
            "Notify me"
          )}
        </Button>
      </div>
    </form>
  );
}
