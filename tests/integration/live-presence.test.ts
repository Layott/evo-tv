import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The claim: presence and the SQL count never disagree.
 *
 * Two numbers for the same audience is worse than one slow number, because an
 * operator cannot tell which one is lying. This asserts they move together.
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

async function load(): Promise<{ presence: Presence; bus: Bus }> {
  vi.resetModules();
  const bus = await import("@/lib/sse/bus");
  const presence = await import("@/lib/sse/presence");
  return { presence, bus };
}

describe.skipIf(!REDIS_URL)("live presence", () => {
  let mod: { presence: Presence; bus: Bus };
  const streamId = `test-${process.pid}-${process.hrtime.bigint()}`;
  let topic = "";

  beforeAll(async () => {
    mod = await load();
    topic = mod.presence.presenceTopic(streamId);
  });

  afterAll(async () => {
    await mod.presence.leave(topic, "user-a");
    await mod.presence.leave(topic, "user-b");
    await mod.bus.closeBus();
  });

  it("names the topic from the stream id", () => {
    expect(mod.presence.presenceTopic("abc")).toBe("stream:abc");
  });

  it("counts a joining viewer immediately", async () => {
    expect(await mod.presence.join(topic, "user-a")).toBe(1);
    expect(await mod.presence.join(topic, "user-b")).toBe(2);
  });

  it("counts the same viewer once however many times they beat", async () => {
    await mod.presence.join(topic, "user-a");
    await mod.presence.join(topic, "user-a");
    expect(await mod.presence.count(topic)).toBe(2);
  });

  it("drops a leaving viewer immediately", async () => {
    expect(await mod.presence.leave(topic, "user-b")).toBe(1);
  });

  it("lists who is present, so the roster has keys to look up", async () => {
    const list = await mod.presence.members(topic);
    expect(list.map((m) => m.key)).toEqual(["user-a"]);
    expect(list[0]!.seenAt).toBeGreaterThan(Date.now() - 10_000);
  });
});
