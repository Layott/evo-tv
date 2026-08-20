"use client";

import * as React from "react";

import { ChevronDown, Info } from "@/components/icons";
import { HOW_TO, type HowToContent, type HowToKey } from "@/lib/admin/how-to-content";

/**
 * What this page is for, on the page.
 *
 * The dashboard grew faster than anyone's memory of it: a screen like Forensic
 * or Encoder setup is obvious to whoever built it and opaque to whoever opens it
 * at eight in the evening with a broadcast running. Documentation in a repo does
 * not help that person, because they are not in the repo.
 *
 * So every screen carries its own short explanation: what the page does, what
 * each control means in the words the screen uses for it, and the order to do
 * the common job in.
 *
 * Open the first time, closed after that, remembered per page. Somebody who
 * knows the dashboard should not read the same paragraph every day, and
 * somebody who does not should never have to go looking for it.
 */

const STORAGE_PREFIX = "evotv:howto:";

export function HowTo({ page }: { page: HowToKey }) {
  // Widened to the shared shape: the literal type of one entry only carries
  // the keys that entry happens to use, which makes optional fields unreachable.
  const content: HowToContent | undefined = HOW_TO[page];
  const [open, setOpen] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(STORAGE_PREFIX + page) === "closed";
    } catch {
      // Storage off. Opening every time is the safer failure: an explanation
      // shown too often is a smaller problem than one that cannot be found.
    }
    setOpen(!collapsed);
    setReady(true);
  }, [page]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_PREFIX + page, next ? "open" : "closed");
      } catch {
        /* nothing to remember it with */
      }
      return next;
    });
  }

  if (!content) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-xl bg-card/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40"
      >
        <Info className="h-4 w-4 shrink-0 text-sky-400" />
        <span className="text-sm font-semibold text-foreground">
          {content.title}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* `ready` keeps the first paint from flashing the panel open for
          somebody who closed it yesterday. */}
      {ready && open ? (
        <div className="space-y-4 px-4 pb-4 pt-1">
          <p className="max-w-[70ch] text-sm text-muted-foreground">
            {content.intro}
          </p>

          {content.points.length > 0 ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {content.points.map((point) => (
                <div key={point.term} className="rounded-lg bg-background/60 p-3">
                  <dt className="text-xs font-semibold text-foreground">
                    {point.term}
                  </dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">
                    {point.detail}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {content.steps && content.steps.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">
                {content.stepsTitle ?? "The usual job, in order"}
              </p>
              <ol className="space-y-1.5">
                {content.steps.map((step: string, i: number) => (
                  <li key={step} className="flex gap-3 text-xs text-muted-foreground">
                    <span className="font-mono text-sky-400">{i + 1}</span>
                    <span className="max-w-[70ch]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {content.watchOut ? (
            <p className="max-w-[70ch] rounded-lg bg-amber-500/15 p-3 text-xs text-amber-100">
              {content.watchOut}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
