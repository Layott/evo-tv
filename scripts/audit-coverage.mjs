/**
 * Which admin writes say what they changed, and which say nothing.
 *
 * The owner opened the audit log on 21 August and found "no fields" on almost
 * every row: 81 of 90 `writeAudit` calls recorded no before/after, so the log
 * could say somebody edited the channel breaks and never what they set them to.
 *
 * The hard rule that came out of it is in CLAUDE.md: an admin write carries both
 * sides. This is how that rule is checked, because a rule nobody can run is a
 * rule that rots.
 *
 *   node scripts/audit-coverage.mjs           list what is missing
 *   node scripts/audit-coverage.mjs --max 12  fail if more than 12 are missing
 *
 * The `--max` form is for CI or a pre-merge check: the number may fall, never
 * rise.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SEARCH_DIRS = ["app", "lib"];

/**
 * Writes that record one side on purpose.
 *
 * A create has no before and a delete has no after; asking for both would push
 * people to invent an empty object, which reads in the log as a change from
 * nothing to nothing. Actions ending in these verbs are allowed one side.
 */
const ONE_SIDED = [".create", ".delete", ".restore", ".send", ".purge", ".fanout"];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** The object literal passed to a call, by brace counting rather than regex. */
function callBody(src, from) {
  const open = src.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

const missing = [];
let total = 0;

for (const dir of SEARCH_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const src = fs.readFileSync(file, "utf8");
    const pattern = /(writeAudit|auditFromGuard)\(/g;
    let match;
    while ((match = pattern.exec(src)) !== null) {
      // The definitions themselves are not call sites.
      if (/export (async )?function /.test(src.slice(Math.max(0, match.index - 60), match.index))) {
        continue;
      }
      const body = callBody(src, match.index);
      if (!body) continue;
      total += 1;

      const action = body.match(/action:\s*"([^"]+)"/)?.[1] ?? "(dynamic)";
      // `before: row` and the shorthand `before,` are the same thing. The
      // first version of this checker knew only the long form and reported a
      // call site that was already correct.
      const carries = (key) =>
        body.includes(`${key}:`) ||
        body.includes(`${key},`) ||
        body.includes(`${key} }`);
      const hasBefore = carries("before");
      const hasAfter = carries("after");
      const oneSided = ONE_SIDED.some((verb) => action.endsWith(verb));
      const satisfied = oneSided ? hasBefore || hasAfter : hasBefore && hasAfter;
      if (satisfied) continue;

      missing.push({
        action,
        file: path.relative(ROOT, file).replace(/\\/g, "/"),
        line: src.slice(0, match.index).split("\n").length,
      });
    }
  }
}

missing.sort((a, b) => a.action.localeCompare(b.action) || a.file.localeCompare(b.file));

for (const row of missing) {
  console.log(`  ${row.action.padEnd(28)} ${row.file}:${row.line}`);
}
console.log(
  `\n${total} audit writes, ${missing.length} record nothing about what changed.`,
);

const maxFlag = process.argv.indexOf("--max");
if (maxFlag !== -1) {
  const max = Number(process.argv[maxFlag + 1] ?? 0);
  if (missing.length > max) {
    console.error(
      `\nOver the agreed ceiling of ${max}. An admin write carries both sides; see the hard rule in CLAUDE.md.`,
    );
    process.exit(1);
  }
}
