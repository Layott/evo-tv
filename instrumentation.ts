export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SENTRY_DSN) await import("./sentry.server.config");
    const { registerTranscodeWorker } = await import("@/workers/transcode");
    registerTranscodeWorker();
  }
  if (process.env.NEXT_RUNTIME === "edge" && process.env.SENTRY_DSN) {
    await import("./sentry.edge.config");
  }
}
