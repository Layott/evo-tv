import "server-only";
import { EventEmitter } from "node:events";

type Payload = unknown;

declare global {
  // eslint-disable-next-line no-var
  var __evo_bus: EventEmitter | undefined;
}

function create(): EventEmitter {
  const bus = new EventEmitter();
  bus.setMaxListeners(10_000);
  return bus;
}

const bus: EventEmitter = globalThis.__evo_bus ?? create();
if (process.env.NODE_ENV !== "production") globalThis.__evo_bus = bus;

export function emit(topic: string, payload: Payload): void {
  bus.emit(topic, payload);
}

export function subscribe(
  topic: string,
  listener: (payload: Payload) => void
): () => void {
  bus.on(topic, listener);
  return () => bus.off(topic, listener);
}

/** SSE helper: converts bus emissions on a topic into a `ReadableStream` of `text/event-stream`. */
export function sseStream(topic: string, initial?: () => Payload): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const send = (payload: Payload) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      };
      if (initial) send(initial());
      const unsub = subscribe(topic, send);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 30_000);
      return () => {
        clearInterval(heartbeat);
        unsub();
      };
    },
    cancel() {
      /* cleanup via start's return */
    },
  });
}
