/**
 * One-shot codemod: hardcoded Tailwind neutrals to semantic theme tokens.
 *
 * Why this exists
 * ---------------
 * The app was written dark-first with literal neutrals: `bg-neutral-950` for
 * the page, `bg-neutral-900` for cards, `text-neutral-400` for secondary type.
 * 1,760 of them across 110 files. A literal does not follow a theme, so the
 * light theme could never work no matter what the CSS variables said: you got
 * a white ground with dark cards still painted on top of it, and dark type on
 * dark surfaces.
 *
 * This maps every one of them onto the semantic token it was standing in for,
 * which is the same fix the light theme needs and the same fix the design
 * parity work needs. Both were the same job.
 *
 * Safety
 * ------
 * - Ordered longest-first, so `bg-neutral-900/60` is rewritten before
 *   `bg-neutral-900` can match its prefix.
 * - Matches are anchored on a class boundary, so `bg-neutral-950` inside a
 *   longer identifier is left alone.
 * - Reads and writes UTF-8 explicitly. A PowerShell round trip on these files
 *   silently mangles every non-ASCII character; see tasks/lessons.md.
 *
 * Run: node scripts/tokenize-neutrals.mjs [--dry]
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];
const DRY = process.argv.includes("--dry");

/**
 * Ordered. Every entry is [literal class, token class].
 *
 * The mapping is not one-to-one by shade, it is by role:
 *  - 950 was the page ground            -> background
 *  - 900 was a card                     -> card
 *  - 800/700 were raised chrome         -> muted
 *  - 800/900 borders                    -> border, 700 borders -> input
 *  - 50/100/200 type                    -> foreground
 *  - 300 type                           -> foreground at 80%, it was a
 *                                          deliberate half-step
 *  - 400/500/600 type                   -> muted-foreground
 *  - 950 type                           -> ink, which never flips: it is the
 *                                          label on a brand-coloured fill
 */
const MAP = [
  // Gradients first: they carry a from-/via-/to- prefix that the plain
  // background rules would otherwise half-match.
  ["from-neutral-950", "from-background"],
  ["via-neutral-950/70", "via-background/70"],
  ["via-neutral-950", "via-background"],
  ["to-neutral-950", "to-background"],
  ["from-neutral-900", "from-card"],
  ["via-neutral-900/60", "via-card/60"],
  ["via-neutral-900", "via-card"],
  ["to-neutral-900/40", "to-card/40"],
  ["to-neutral-900", "to-card"],

  // Page ground.
  ["bg-neutral-950/95", "bg-background/95"],
  ["bg-neutral-950/90", "bg-background/90"],
  ["bg-neutral-950/70", "bg-background/70"],
  ["bg-neutral-950/60", "bg-background/60"],
  ["bg-neutral-950", "bg-background"],

  // Cards.
  ["hover:bg-neutral-900/70", "hover:bg-accent/70"],
  ["hover:bg-neutral-900/60", "hover:bg-accent/60"],
  ["hover:bg-neutral-900", "hover:bg-accent"],
  ["bg-neutral-900/95", "bg-card/95"],
  ["bg-neutral-900/80", "bg-card/80"],
  ["bg-neutral-900/60", "bg-card/60"],
  ["bg-neutral-900/50", "bg-card/50"],
  ["bg-neutral-900/40", "bg-card/40"],
  ["bg-neutral-900/30", "bg-card/30"],
  ["bg-neutral-900", "bg-card"],

  // Raised chrome.
  ["hover:bg-neutral-800/60", "hover:bg-accent/60"],
  ["hover:bg-neutral-800", "hover:bg-accent"],
  ["bg-neutral-800/60", "bg-muted/60"],
  ["bg-neutral-800/50", "bg-muted/50"],
  ["bg-neutral-800", "bg-muted"],
  ["bg-neutral-700/40", "bg-muted/40"],
  ["bg-neutral-700", "bg-muted"],

  // Mid-tone fills: dots, bars, scrims. They need to stay visible against
  // either ground, which is exactly what muted-foreground is for.
  ["bg-neutral-600", "bg-muted-foreground"],
  ["bg-neutral-500/60", "bg-muted-foreground/60"],
  ["bg-neutral-500", "bg-muted-foreground"],
  ["bg-neutral-400", "bg-muted-foreground"],

  // Borders. 700 was the emphasis border, so it keeps a step of its own.
  ["group-hover:border-neutral-700", "group-hover:border-input"],
  ["hover:border-neutral-700", "hover:border-input"],
  ["hover:border-neutral-600", "hover:border-input"],
  ["hover:border-neutral-500", "hover:border-input"],
  ["border-neutral-950", "border-border"],
  ["border-neutral-900/60", "border-border/60"],
  ["border-neutral-900", "border-border"],
  ["border-neutral-800", "border-border"],
  ["border-neutral-700", "border-input"],
  ["divide-neutral-900", "divide-border"],
  ["divide-neutral-800", "divide-border"],
  ["ring-neutral-600/50", "ring-ring/50"],

  // Type. Hover variants before their base classes.
  ["group-hover:text-neutral-200", "group-hover:text-foreground"],
  ["hover:text-neutral-50", "hover:text-foreground"],
  ["hover:text-neutral-100", "hover:text-foreground"],
  ["hover:text-neutral-200", "hover:text-foreground"],
  ["hover:text-neutral-300", "hover:text-foreground"],
  ["placeholder:text-neutral-600", "placeholder:text-muted-foreground"],
  ["placeholder:text-neutral-500", "placeholder:text-muted-foreground"],
  ["text-neutral-950", "text-ink"],
  ["fill-neutral-950", "fill-ink"],
  ["text-neutral-50", "text-foreground"],
  ["text-neutral-100", "text-foreground"],
  ["text-neutral-200", "text-foreground"],
  ["text-neutral-300", "text-foreground/80"],
  ["text-neutral-400", "text-muted-foreground"],
  ["text-neutral-500", "text-muted-foreground"],
  ["text-neutral-600", "text-muted-foreground"],
];

// Longest literal first so no rule can be shadowed by a shorter prefix.
MAP.sort((a, b) => b[0].length - a[0].length);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * A class ends at whitespace, a quote, a backtick, or a brace. Anchoring on
 * that stops `bg-neutral-900` from eating the front of `bg-neutral-900/60`
 * even if the ordering above were ever wrong.
 */
const RULES = MAP.map(([from, to]) => [
  new RegExp(`(?<=^|[\\s"'\`{])${escapeRe(from)}(?=$|[\\s"'\`}])`, "g"),
  to,
  from,
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

let filesChanged = 0;
let replacements = 0;
const perRule = new Map();

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const before = readFileSync(file, "utf8");
    let after = before;
    for (const [re, to, from] of RULES) {
      const hits = after.match(re);
      if (!hits) continue;
      perRule.set(from, (perRule.get(from) ?? 0) + hits.length);
      replacements += hits.length;
      after = after.replace(re, to);
    }
    if (after !== before) {
      filesChanged += 1;
      if (!DRY) writeFileSync(file, after, "utf8");
    }
  }
}

console.log(`${DRY ? "[dry] " : ""}${replacements} replacements in ${filesChanged} files`);

const leftovers = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/[\w:[\]/-]*neutral-\d{2,3}(?:\/\d{1,3})?/g)) {
      leftovers.push(`${file}: ${m[0]}`);
    }
  }
}
if (leftovers.length) {
  console.log(`\n${leftovers.length} neutral utilities left unmapped:`);
  for (const l of leftovers.slice(0, 40)) console.log("  " + l);
} else {
  console.log("no neutral utilities left");
}
