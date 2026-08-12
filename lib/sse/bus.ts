import "server-only";
import { EventEmitter } from "node:events";
import Redis from "ioredis";

type Payload = unknown;

/**
 * Pub/sub behind the four SSE routes (chat, stream, party, notifications).
 *
 * Two backends, same exports:
 *
 * - **Valkey / Redis** when REDIS_URL is set. Every process publishes to and
 *   subscribes from one broker, so any container can serve any subscriber.
 *   This is what allows more than one `api` container, which is what allows a
 *   deploy with no downtime.
 * - **In-process EventEmitter** otherwise. Correct for local dev and for a
 *   single process, and it is what shipped before.
 *
 * The single-process version was not merely a scaling limit, it was a bug on
 * Vercel: an emit on one lambda was invisible to a subscriber on another, so
 * chat messages silently vanished whenever the two landed on different
 * instances.
 *
 * Payloads cross the broker as JSON, so a Date arrives as an ISO string rather
 * than a Date. Every consumer immediately JSON-serializes into an SSE frame,
 * so what reaches the client is byte-identical either way.
 */

const CHANNEL_PREFIX = "evo:";
const REDIS_URL = process.env.REDIS_URL;

declare global {
  // eslint-disable-next-line no-var
  var __evo_bus: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __evo_redis_pub: Redis | undefined;
  // eslint-disable-next-line no-var
  var __evo_redis_sub: Redis | undefined;
}

function createLocalBus(): EventEmitter {
  const bus = new EventEmitter();
  // One listener per open SSE connection, so the default cap of 10 would warn
  // almost immediately.
  bus.setMaxListeners(10_000);
  return bus;
}

/**
 * Local fan-out. In Redis mode this is still the delivery mechanism: the
 * subscriber connection receives a message and re-emits it here, which keeps
 * `subscribe()` synchronous and unchanged for every call site.
 */
const bus: EventEmitter = globalThis.__evo_bus ?? createLocalBus();

function createRedis(url: string, role: string): Redis {
  const client = new Redis(url, {
    // A dropped broker must not take the process down with an unhandled error.
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    console.error(`[sse-bus] redis ${role} error:`, err.message);
  });
  return client;
}

let publisher: Redis | undefined;

if (REDIS_URL) {
  publisher = globalThis.__evo_redis_pub ?? createRedis(REDIS_URL, "publisher");

  // A connection in subscriber mode cannot issue other commands, so publishing
  // and subscribing need separate connections.
  const subscriber = globalThis.__evo_redis_sub ?? createRedis(REDIS_URL, "subscriber");

  if (!globalThis.__evo_redis_sub) {
    // One pattern subscription for every topic. Subscribing per topic would
    // mean tracking refcounts and racing unsubscribes against new listeners
    // for no benefit at this volume.
    void subscriber.psubscribe(`${CHANNEL_PREFIX}*`).catch((err) => {
      console.error("[sse-bus] psubscribe failed:", err.message);
    });

    subscriber.on("pmessage", (_pattern, channel: string, message: string) => {
      const topic = channel.slice(CHANNEL_PREFIX.length);
      try {
        bus.emit(topic, JSON.parse(message));
      } catch {
        // A malformed frame must not kill the subscriber connection.
      }
    });
  }

  if (process.env.NODE_ENV !== "production") {
    globalThis.__evo_redis_pub = publisher;
    globalThis.__evo_redis_sub = subscriber;
  }
}

// Cache across HMR reloads so a hot reload does not strand listeners or
// connections.
if (process.env.NODE_ENV !== "production") globalThis.__evo_bus = bus;

/**
 * The publishing connection, for code that needs plain commands rather than
 * pub/sub. Undefined when REDIS_URL is unset, which is the signal to fall back
 * to per-process state. Only the subscriber connection is in subscriber mode,
 * so this one can run ordinary commands.
 */
export function redisClient(): Redis | undefined {
  return publisher;
}

export function emit(topic: string, payload: Payload): void {
  if (publisher) {
    // Publish only. The subscriber connection loops it back to this process
    // too, so emitting locally as well would deliver every message twice.
    void publisher
      .publish(`${CHANNEL_PREFIX}${topic}`, JSON.stringify(payload))
      .catch((err) => {
        console.error("[sse-bus] publish failed:", err.message);
      });
    return;
  }
  bus.emit(topic, payload);
}

export function subscribe(
  topic: string,
  listener: (payload: Payload) => void
): () => void {
  bus.on(topic, listener);
  return () => bus.off(topic, listener);
}

/**
 * SSE helper: converts bus emissions on a topic into a `ReadableStream` of
 * `text/event-stream`.
 *
 * Currently unused; the four SSE routes each inline this shape because they
 * also do per-route bookkeeping (viewer sets, hello frames). Kept because it
 * is the correct shape for a route that needs nothing extra.
 */
export function sseStream(topic: string, initial?: () => Payload): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  return new ReadableStream({
    start(controller) {
      const send = (payload: Payload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* closed */
        }
      };
      if (initial) send(initial());
      const unsub = subscribe(topic, send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 30_000);

      // A value returned from start() is NOT treated as a teardown function by
      // the streams spec, so this has to be reachable from cancel() instead.
      // Returning it was a leak: the interval and the subscription both
      // outlived the connection.
      cleanup = () => {
        clearInterval(heartbeat);
        unsub();
      };
    },
    cancel() {
      cleanup();
    },
  });
}
