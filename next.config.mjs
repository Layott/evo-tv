import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  // Poll instead of trusting filesystem events, in development only.
  //
  // Turbopack's watcher misses git-driven bulk writes on Windows: a branch
  // switch or a pull rewrites dozens of files in one go and the events either
  // arrive coalesced or not at all. When the file it misses is app/globals.css
  // the running server keeps serving the stylesheet it compiled from the old
  // one, which reads as a CSS bug and sends you into the wrong file. That is
  // exactly how the border change appeared not to reach /admin on 2026-08-17.
  //
  // One poll a second across this tree is cheap next to an hour of that.
  // `scripts/dev-css-guard.mjs` covers the other half, where the change lands
  // while the server is stopped and polling has nothing to notice.
  ...(process.env.NODE_ENV === "production"
    ? {}
    : { watchOptions: { pollIntervalMs: 1000 } }),
};

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

const hasSentryCreds =
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!process.env.SENTRY_AUTH_TOKEN;

export default hasSentryCreds
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
