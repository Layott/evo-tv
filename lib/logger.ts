import "server-only";
import fs from "node:fs";
import path from "node:path";
import pino from "pino";

const LOG_DIR = path.resolve("./storage/logs");
const LOG_FILE = path.join(LOG_DIR, "app.jsonl");

fs.mkdirSync(LOG_DIR, { recursive: true });

// Duplicate JSON lines to both stdout and the on-disk jsonl file.
// pino.multistream is synchronous-safe and cheap; good enough for a
// single-process dev/staging footprint. For production clustering you'd
// swap this for a transport.
const streams: pino.StreamEntry[] = [
  { level: "info", stream: process.stdout },
  { level: "info", stream: fs.createWriteStream(LOG_FILE, { flags: "a" }) },
];

export const log = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "evo-tv" },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(streams)
);

export type Logger = typeof log;
