import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  // Was VERCEL_ENV and VERCEL_GIT_COMMIT_SHA, which have been undefined
  // since the move off Vercel, so every report claimed to be development.
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.APP_COMMIT ?? "dev",
});
