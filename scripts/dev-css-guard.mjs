#!/usr/bin/env node
/**
 * Refuses to start `next dev` on a Turbopack cache that was built from
 * different CSS than the CSS on disk.
 *
 * The bug this exists to prevent: on 2026-08-17 the border tokens were changed
 * to `transparent`, and /admin kept painting hairlines for an hour. The source
 * said transparent, the browser said `#12383a`, and nothing about the page
 * explained the gap. The dev server had been started before the change landed,
 * the change arrived as a branch switch rather than a keystroke, and Turbopack
 * served the stylesheet it had already compiled. Editing globals.css again did
 * not invalidate it. `rm -rf .next` did.
 *
 * That failure costs an hour every time because it looks like a CSS bug, not a
 * cache bug, so the search goes to the wrong file. The rule "always rm -rf
 * .next first" is not a fix, it is a ritual nobody remembers under pressure.
 *
 * So: hash the inputs that decide the compiled stylesheet, stamp the hash next
 * to the cache, and compare on the next start. Same hash, keep the cache and
 * the fast startup. Different hash, drop `.next` before Turbopack can serve
 * from it. The running-server half of the problem is handled separately by
 * `watchOptions.pollIntervalMs` in next.config.mjs, which stops the watcher
 * missing git-driven bulk writes on Windows in the first place.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(root, ".next");
const stampFile = join(nextDir, "css-guard-stamp");

/**
 * Everything that changes the compiled stylesheet. Tailwind 4 keeps its theme
 * inside `app/globals.css` (`@theme`), so there is no tailwind.config.js to
 * watch here; if one is ever added, add it to this list.
 */
const INPUTS = [
  "app/globals.css",
  "postcss.config.mjs",
];

function fingerprint() {
  const hash = createHash("sha256");
  for (const rel of INPUTS) {
    const abs = join(root, rel);
    hash.update(rel);
    hash.update(existsSync(abs) ? readFileSync(abs) : Buffer.from("<missing>"));
  }
  // A Tailwind upgrade changes the output without touching either file.
  try {
    const pkg = JSON.parse(
      readFileSync(join(root, "node_modules/tailwindcss/package.json"), "utf8"),
    );
    hash.update(String(pkg.version));
  } catch {
    hash.update("<no-tailwind>");
  }
  return hash.digest("hex");
}

const current = fingerprint();
const previous = existsSync(stampFile)
  ? readFileSync(stampFile, "utf8").trim()
  : null;

if (previous && previous !== current) {
  console.log(
    "[css-guard] app/globals.css changed while the dev server was down. " +
      "Clearing .next so Turbopack cannot serve the stylesheet it compiled " +
      "from the old file.",
  );
  rmSync(nextDir, { recursive: true, force: true });
}

mkdirSync(nextDir, { recursive: true });
writeFileSync(stampFile, current);
