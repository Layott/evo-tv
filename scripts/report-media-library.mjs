#!/usr/bin/env node
/**
 * report-media-library.mjs
 * ────────────────────────────────────────────────────────────────────────────
 * Office media-agent. Scans the playout box's media folder and reports the file
 * list UP to the cloud (POST /api/internal/playout-media), so files dropped on
 * the office PC automatically appear in the EVO TV admin's schedule file picker.
 *
 * Files removed from the folder are soft-deleted server-side on the next run.
 *
 * Requires Node 18+ (global fetch). No npm deps. ffprobe optional (durations).
 *
 *   node scripts/report-media-library.mjs
 *   DRY_RUN=1 node scripts/report-media-library.mjs     # print, don't POST
 *
 * Run on a short cron / file-watch so the admin stays current, e.g. every 2 min:
 *   * /2 * * * *  node /opt/evotv/scripts/report-media-library.mjs   (remove the space)
 *
 * Env:
 *   EVOTV_API_BASE   e.g. https://evo-tv.vercel.app
 *   PLAYOUT_SECRET   must match the backend's PLAYOUT_SECRET
 *   MEDIA_DIR        absolute path to the media library root (default ./media)
 *   PROBE_DURATION   "1" to read each file's duration via ffprobe (slower)
 */

import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const API_BASE = (process.env.EVOTV_API_BASE || "").replace(/\/$/, "");
const SECRET = process.env.PLAYOUT_SECRET || "";
const MEDIA_DIR = process.env.MEDIA_DIR || "./media";
const PROBE = process.env.PROBE_DURATION === "1";
const DRY_RUN = process.env.DRY_RUN === "1";

const VIDEO_EXT = new Set([".mp4", ".mkv", ".mov", ".m4v", ".ts", ".webm", ".flv", ".avi"]);

if (!DRY_RUN && (!API_BASE || !SECRET)) {
  console.error("Missing EVOTV_API_BASE or PLAYOUT_SECRET");
  process.exit(1);
}

/** Recursively collect video files under dir. */
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    console.error(`Cannot read ${dir}: ${e.message}`);
    return out;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (ent.isFile() && VIDEO_EXT.has(extname(ent.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

async function probeDuration(path) {
  try {
    const { stdout } = await execFileP("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    const s = Math.round(parseFloat(stdout.trim()));
    return Number.isFinite(s) && s > 0 ? s : null;
  } catch {
    return null; // ffprobe missing or unreadable — duration is optional
  }
}

async function main() {
  const paths = await walk(MEDIA_DIR);
  const files = [];
  for (const p of paths) {
    let sizeMb = null;
    try {
      const st = await stat(p);
      sizeMb = Math.max(1, Math.round(st.size / (1024 * 1024)));
    } catch {
      /* skip size */
    }
    files.push({
      path: p,
      name: basename(p),
      sizeMb,
      durationSec: PROBE ? await probeDuration(p) : null,
    });
  }

  console.log(`Scanned ${MEDIA_DIR}: ${files.length} video files.`);

  if (DRY_RUN) {
    console.log(JSON.stringify({ files }, null, 2));
    return;
  }

  const res = await fetch(`${API_BASE}/api/internal/playout-media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    console.error(`Report failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Reported: ${JSON.stringify(await res.json())}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
