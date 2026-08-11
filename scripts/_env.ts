/**
 * Environment loading for standalone scripts.
 *
 * Every script here used `import "dotenv/config"`, which reads `.env` and
 * nothing else. This repo has no `.env`: the real configuration is in
 * `.env.local`, which Next.js loads for the app but plain dotenv does not. So
 * each script started with an empty environment and exited with "No database
 * URL in the environment", including `promote-admin.ts`, which is the
 * documented way to create the first admin account.
 *
 * Import this instead. Precedence matches Next.js: `.env.local` wins, `.env`
 * fills gaps, and anything already exported in the shell beats both.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// tsx compiles these to CJS, where `import.meta.dirname` is undefined. Scripts
// are invoked as `pnpm tsx scripts/x.ts` from the repo root, so cwd is the
// root; the parent is checked too in case one is run from inside `scripts/`.
const ROOTS = [process.cwd(), resolve(process.cwd(), "..")];

for (const root of ROOTS) {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(root, file);
    if (existsSync(path)) config({ path, override: false, quiet: true });
  }
}

/**
 * The connection string, checked in the same order the app checks it.
 *
 * Scripts run migrations and bulk writes, so the unpooled URL comes first: a
 * pooled connection can drop a long transaction mid-run.
 */
export function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL
  );
}
