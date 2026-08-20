"use client";

import * as React from "react";

/**
 * A deploy must not break the tab somebody already had open.
 *
 * Every build gives the JavaScript chunks new names, and the old names stop
 * existing the moment the new build is live. A tab that was loaded before the
 * deploy still holds the old names, so the next lazily-loaded piece of the page
 * 404s and throws `ChunkLoadError`. Measured on production during this
 * session's deploys: eighteen of them in one tab, against chunks from the
 * previous build.
 *
 * What that looks like to a viewer is not an error. It is a control that does
 * nothing, or a player that never starts, with a console nobody is reading. The
 * page is not broken in a way anyone can see, and it stays broken until the tab
 * is reloaded by hand, which is precisely the thing the owner should not have
 * to do.
 *
 * So: catch it and reload once. The URL survives a reload, and the alternative
 * is a page that silently lies about what it can do.
 */

/** Turbopack, webpack and the browser all word this differently. */
const CHUNK_ERROR = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to load chunk|Importing a module script failed|error loading dynamically imported module/i;

/**
 * One reload per minute, at most.
 *
 * A reload that lands on the same broken build would loop, and a reload loop is
 * far worse than the fault it is trying to repair: the viewer cannot read the
 * page long enough to know what is happening. `sessionStorage` because the
 * limit belongs to this tab, not to the browser.
 */
const KEY = "evotv:chunk-reload-at";
const COOLDOWN_MS = 60_000;

export function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Private mode with storage disabled: reloading once is still better than
    // leaving the tab half working, and the cooldown is the only thing lost.
  }
  window.location.reload();
}

export function isChunkError(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === "string") return CHUNK_ERROR.test(value);
  if (value instanceof Error) {
    return CHUNK_ERROR.test(value.name) || CHUNK_ERROR.test(value.message);
  }
  const maybe = value as { name?: unknown; message?: unknown };
  return (
    (typeof maybe.name === "string" && CHUNK_ERROR.test(maybe.name)) ||
    (typeof maybe.message === "string" && CHUNK_ERROR.test(maybe.message))
  );
}

export function StaleBuildGuard() {
  React.useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkError(event.error) || isChunkError(event.message)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkError(event.reason)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
