#!/usr/bin/env node
/**
 * push-epg-to-ffplayout.mjs
 * ────────────────────────────────────────────────────────────────────────────
 * EPG → ffplayout playlist adapter (runs on the OFFICE server).
 *
 * Reads EVO TV's combined schedule (GET /api/schedule) for a given day, maps
 * each program to a local media file (or a live-input URL) via media-map.json,
 * pads the gaps with filler so each program hits its real wall-clock time, then
 * uploads the day's playlist to ffplayout (POST /api/playlist/{channel}/).
 *
 * One source of truth: the same /api/schedule that drives the app's TV guide
 * also drives what actually airs - they cannot drift.
 *
 * Requires Node 18+ (uses global fetch). No build step, no npm deps.
 *
 *   node scripts/push-epg-to-ffplayout.mjs            # pushes TOMORROW
 *   node scripts/push-epg-to-ffplayout.mjs 2026-06-12 # pushes a specific day
 *   DRY_RUN=1 node scripts/push-epg-to-ffplayout.mjs  # print, don't upload
 *
 * Env (set in the office server's environment or a .env you source first):
 *   EVOTV_API_BASE        https://api.evotv.co (the Vercel host in this line
 *                         until today has been dead since the DigitalOcean move)
 *   FFPLAYOUT_URL         e.g. http://127.0.0.1:8787
 *   FFPLAYOUT_USER        ffplayout admin username
 *   FFPLAYOUT_PASS        ffplayout admin password
 *   FFPLAYOUT_CHANNEL_ID  numeric channel id in ffplayout (default 1)
 *   MEDIA_MAP             path to media-map.json (default ./scripts/media-map.json)
 *   FILLER_SOURCE         absolute path to a filler/bumper file (loops in gaps)
 *   FILLER_DURATION_SEC   length of the filler file in seconds (default 60)
 *   DAY_START             channel day start "HH:MM:SS" (default 00:00:00)
 *   PILLAR                esports|anime|lifestyle|all (default all)
 *
 * Cron it daily, e.g. 03:00 the night before:
 *   0 3 * * *  node /opt/evotv/scripts/push-epg-to-ffplayout.mjs
 */

const API_BASE = need("EVOTV_API_BASE");
const FFP_URL = (process.env.FFPLAYOUT_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const FFP_USER = need("FFPLAYOUT_USER");
const FFP_PASS = need("FFPLAYOUT_PASS");
const CHANNEL_ID = process.env.FFPLAYOUT_CHANNEL_ID || "1";
const MEDIA_MAP_PATH = process.env.MEDIA_MAP || "./scripts/media-map.json";
const FILLER_SOURCE = process.env.FILLER_SOURCE || "";
const FILLER_DURATION_SEC = Number(process.env.FILLER_DURATION_SEC || "60");
const DAY_START = process.env.DAY_START || "00:00:00";
const PILLAR = process.env.PILLAR || "all";
const PLAYOUT_SECRET = process.env.PLAYOUT_SECRET || "";
const DRY_RUN = process.env.DRY_RUN === "1";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v.replace(/\/$/, "");
}

/** "HH:MM:SS" → seconds since midnight. */
function hmsToSec(hms) {
  const [h, m, s] = hms.split(":").map((n) => Number(n) || 0);
  return h * 3600 + m * 60 + s;
}

/** ISO timestamp → seconds since midnight (UTC time-of-day). */
function isoSecondsOfDay(iso) {
  const d = new Date(iso);
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

function targetDate(argDate) {
  if (argDate && /^\d{4}-\d{2}-\d{2}$/.test(argDate)) return argDate;
  if (argDate === "today") return new Date().toISOString().slice(0, 10);
  const d = new Date(Date.now() + 24 * 3600 * 1000); // tomorrow (default)
  return d.toISOString().slice(0, 10);
}

/**
 * Admin-chosen files (set in the EVO TV app's schedule editor) override the
 * local media-map.json. Returns { "stream_<id>": "<file path>" }.
 */
async function loadServerResolve(date) {
  if (!PLAYOUT_SECRET) return {};
  try {
    const res = await fetch(
      `${API_BASE}/api/internal/playout-resolve?date=${date}`,
      { headers: { Authorization: `Bearer ${PLAYOUT_SECRET}` } },
    );
    if (!res.ok) {
      console.warn(`resolve map fetch failed: ${res.status}`);
      return {};
    }
    const j = await res.json();
    return j.map || {};
  } catch (e) {
    console.warn(`resolve map error: ${e.message}`);
    return {};
  }
}

async function loadMediaMap() {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(MEDIA_MAP_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`No media map at ${MEDIA_MAP_PATH} (${e.message}). All programs will fall to filler.`);
    return {};
  }
}

/** Resolve an EpgRow to a playout source (file path or live URL), or null. */
function resolveSource(row, map) {
  if (map[row.id]) return map[row.id];
  if (row.watchUrl && map[row.watchUrl]) return map[row.watchUrl];
  return null;
}

/** Push N filler items (looping the filler file) to consume `gapSec`. */
function pushFiller(program, gapSec) {
  if (gapSec <= 0) return;
  if (!FILLER_SOURCE) {
    console.warn(`  gap of ${gapSec}s with no FILLER_SOURCE set - ffplayout's own filler will cover it`);
    return;
  }
  let remaining = gapSec;
  while (remaining > 0) {
    const chunk = Math.min(remaining, FILLER_DURATION_SEC);
    program.push({ in: 0, out: chunk, duration: chunk, source: FILLER_SOURCE });
    remaining -= chunk;
  }
}

async function main() {
  const date = targetDate(process.argv[2]);
  const map = await loadMediaMap();
  // Admin picks from the app win over the local media-map.json.
  Object.assign(map, await loadServerResolve(date));

  // 1. Fetch the EPG for the day.
  const url = `${API_BASE}/api/schedule?date=${date}&pillar=${PILLAR}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Schedule fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : payload.rows || payload.data || [];
  rows.sort((a, b) => String(a.airsAt).localeCompare(String(b.airsAt)));

  // 2. Build the ffplayout program, padding gaps so each item hits its time.
  const dayStartSec = hmsToSec(DAY_START);
  let cursor = dayStartSec;
  const program = [];
  let aired = 0;
  let skipped = 0;

  for (const row of rows) {
    const source = resolveSource(row, map);
    const durationSec = Math.max(1, Math.round((row.durationMin ?? 60) * 60));
    if (!source) {
      console.warn(`  no media for ${row.id} "${row.title}" - leaving its slot to filler`);
      skipped++;
      continue;
    }
    let targetSec = isoSecondsOfDay(row.airsAt);
    if (targetSec < dayStartSec) targetSec += 24 * 3600; // wrap past-midnight starts
    if (targetSec > cursor) {
      pushFiller(program, targetSec - cursor);
      cursor = targetSec;
    }
    const isLiveUrl = /^(rtmp|rtmps|srt|http|https):\/\//.test(source);
    program.push({
      in: 0,
      out: durationSec,
      duration: durationSec,
      source,
      // carry the EPG id so the ffplayout `task` hook can deep-link the app
      category: row.id,
      title: row.title,
      ...(isLiveUrl ? { audio: "", custom_filter: "" } : {}),
    });
    cursor += durationSec;
    aired++;
  }

  const playlist = { channel: `Channel ${CHANNEL_ID}`, date, program };

  console.log(`EPG ${date}: ${rows.length} rows → ${aired} aired, ${skipped} skipped, ${program.length} playlist items, ends ${(cursor / 3600).toFixed(2)}h`);

  if (DRY_RUN) {
    console.log(JSON.stringify(playlist, null, 2));
    return;
  }

  // 3. Auth to ffplayout, upload the playlist.
  const token = await ffpLogin();
  const put = await fetch(`${FFP_URL}/api/playlist/${CHANNEL_ID}/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(playlist),
  });
  if (!put.ok) {
    console.error(`Playlist upload failed: ${put.status} ${await put.text()}`);
    process.exit(1);
  }
  console.log(`Uploaded playlist for ${date} to ffplayout channel ${CHANNEL_ID}.`);
}

async function ffpLogin() {
  const res = await fetch(`${FFP_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: FFP_USER, password: FFP_PASS }),
  });
  if (!res.ok) {
    console.error(`ffplayout login failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const j = await res.json();
  const token = j.token || j.access_token || (j.user && j.user.token);
  if (!token) {
    console.error(`ffplayout login: no token in response: ${JSON.stringify(j)}`);
    process.exit(1);
  }
  return token;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
