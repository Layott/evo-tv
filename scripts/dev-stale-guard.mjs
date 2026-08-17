#!/usr/bin/env node
/**
 * Refuses to start `next dev` on a Turbopack build that is older than the
 * source it was built from.
 *
 * ## The failure this exists to prevent
 *
 * Twice now, hours have gone into debugging code that was not running.
 *
 * On 2026-08-17 the border tokens were set to `transparent` and /admin kept
 * painting hairlines. The source said transparent, the browser said `#12383a`.
 * Later the same day the whole /upgrade page was rewritten and the browser
 * kept serving the previous version, headline and all - `grep` proved the new
 * text was in the file and absent from every compiled chunk, and the dev server
 * had logged **zero** compiles for its entire session.
 *
 * Both times the server had been started before the change and its watcher had
 * gone deaf. Both times the fix was to delete `.next` and restart. Both times
 * the symptom pointed at the wrong file, because a stale build looks exactly
 * like a bug in the code you are reading.
 *
 * ## What does and does not fix it
 *
 * `watchOptions.pollIntervalMs` in next.config.mjs is real - Turbopack reads it
 * (`hot-reloader-turbopack.js` passes it into `createProject` as
 * `watch.pollIntervalMs`), it is not webpack-only as it first appears. It is
 * kept, because polling is the right thing to ask for. But it did NOT rescue
 * the /upgrade case: the watcher stayed silent through an edit and a touch, so
 * treat it as a belt, not the fix.
 *
 * The reliable half is this: a build is only trusted if nothing under the
 * source tree is newer than the build. Otherwise `.next` goes, and Turbopack
 * starts from scratch. On this project that costs well under a second - the
 * clean start after the /upgrade rewrite reported "Ready in 415ms" - which is
 * nothing against an hour of reading the right file and disbelieving it.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(root, ".next");
const stampFile = join(nextDir, "dev-guard-stamp");

/** Directories whose contents decide what the build should contain. */
const SOURCE_DIRS = ["app", "components", "lib", "db", "hooks", "styles"];

/** Single files that change the whole build. */
const SOURCE_FILES = [
  "next.config.mjs",
  "postcss.config.mjs",
  "package.json",
  "tsconfig.json",
];

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|css|json)$/;

/**
 * Newest modification time across the source, plus a count.
 *
 * mtime rather than content hashing: this runs before every `pnpm dev`, and
 * reading a few thousand files to hash them would add more delay than the
 * rebuild it is trying to avoid. The count is in the stamp too, so deleting a
 * file is caught even though deletion moves no mtime forward.
 */
function sourceState() {
  let newest = 0;
  let count = 0;

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
        walk(p);
        continue;
      }
      if (!SOURCE_EXT.test(e.name)) continue;
      count++;
      const m = statSync(p).mtimeMs;
      if (m > newest) newest = m;
    }
  };

  for (const d of SOURCE_DIRS) walk(join(root, d));
  for (const f of SOURCE_FILES) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    count++;
    const m = statSync(p).mtimeMs;
    if (m > newest) newest = m;
  }

  // Tailwind's version changes the CSS output without touching a source file.
  let tw = "none";
  try {
    tw = JSON.parse(readFileSync(join(root, "node_modules/tailwindcss/package.json"), "utf8")).version;
  } catch {
    /* not installed yet, first run */
  }

  return createHash("sha256")
    .update(`${Math.floor(newest)}|${count}|${tw}`)
    .digest("hex");
}

const current = sourceState();
const previous = existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : null;

if (!existsSync(nextDir)) {
  // Nothing to be stale. Just record the state.
} else if (previous !== current) {
  console.log(
    "[dev-guard] source changed while the dev server was down. Clearing .next " +
      "so Turbopack cannot serve a build made from the old files.",
  );
  rmSync(nextDir, { recursive: true, force: true });
}

mkdirSync(nextDir, { recursive: true });
writeFileSync(stampFile, current);
