import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The claim this file exists to test: two api containers agree on how many
 * people are watching.
 *
 * That was the whole bug. A per-process Map cannot be tested for it, because
 * inside one process it looks perfectly correct. So each "container" here is a
 * separately loaded copy of the module, via `vi.resetModules()`: its own module
 * registry, its own Redis connections, no shared memory. If the two agree, the
 * only thing they can be agreeing through is Valkey.
 *
 * Needs a broker:
 *
 *   docker run --rm -d -p 6399:6379 --name evo-test-valkey valkey/valkey:8-alpine
 *   REDIS_URL=redis://127.0.0.1:6399 pnpm test:integration
 *   docker rm -f evo-test-valkey
 */

const REDIS_URL = process.env.REDIS_URL;

type Presence = typeof import("@/lib/sse/presence");
type Bus = typeof import("@/lib/sse/bus");

/** One "container": a fresh module registry, so fresh connections. */
async function loadContainer(): Promise<{ presence: Presence; bus: Bus }> {
  vi.resetModules();
  const bus = await import("@/lib/sse/bus");
  const presence = await import("@/lib/sse/presence");
  return { presence, bus };
}

describe.skipIf(!REDIS_URL)("viewer presence across containers", () => {
  let a: { presence: Presence; bus: Bus };
  let b: { presence: Presence; bus: Bus };
  // Unique per run, so a rerun never inherits members from the last one.
  const topic = `test:stream:${process.pid}:${process.hrtime.bigint()}`;

  beforeAll(async () => {
    a = await loadContainer();
    b = await loadContainer();
  });

  afterAll(async () => {
    await a.presence.leave(topic, "viewer-a");
    await b.presence.leave(topic, "viewer-b");
    // ioredis keeps the event loop alive; without this the run hangs green.
    await a.bus.closeBus();
    await b.bus.closeBus();
  });

  it("counts a viewer that joined on the other container", async () => {
    expect(await a.presence.join(topic, "viewer-a")).toBe(1);
    // The number container B reports includes the viewer it never saw.
    expect(await b.presence.join(topic, "viewer-b")).toBe(2);
    expect(await a.presence.count(topic)).toBe(2);
  });

  it("does not double-count a reconnecting viewer", async () => {
    // A dropped connection that comes back is the same person. Score updates,
    // membership does not grow.
    expect(await a.presence.refresh(topic, "viewer-a")).toBe(2);
    expect(await b.presence.count(topic)).toBe(2);
  });

  it("drops a viewer on the container that did not serve them", async () => {
    expect(await a.presence.leave(topic, "viewer-b")).toBe(1);
    expect(await b.presence.count(topic)).toBe(1);
  });

  it("separates one stream from another", async () => {
    const other = `${topic}:other`;
    expect(await b.presence.join(other, "viewer-c")).toBe(1);
    expect(await a.presence.count(topic)).toBe(1);
    await b.presence.leave(other, "viewer-c");
  });
});

describe.skipIf(Boolean(REDIS_URL))("viewer presence with no broker", () => {
  it("falls back to this process, which is correct for one container", async () => {
    const { presence } = await loadContainer();
    const topic = `test:fallback:${process.pid}`;
    expect(await presence.join(topic, "v1")).toBe(1);
    expect(await presence.join(topic, "v2")).toBe(2);
    expect(await presence.leave(topic, "v1")).toBe(1);
    expect(await presence.count(topic)).toBe(1);
  });
});
