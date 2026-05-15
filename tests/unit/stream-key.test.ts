import { describe, expect, it } from "vitest";
import {
  compareStreamKey,
  generateStreamKey,
  hashStreamKey,
} from "@/lib/video/stream-key";

describe("generateStreamKey", () => {
  it("produces sk_live_ prefix + 32 hex chars", () => {
    const k = generateStreamKey();
    expect(k.startsWith("sk_live_")).toBe(true);
    expect(k.length).toBe("sk_live_".length + 32);
    expect(/^sk_live_[0-9a-f]{32}$/.test(k)).toBe(true);
  });

  it("two consecutive calls return different keys", () => {
    expect(generateStreamKey()).not.toBe(generateStreamKey());
  });
});

describe("hashStreamKey", () => {
  it("is deterministic for the same input", () => {
    const k = generateStreamKey();
    expect(hashStreamKey(k)).toBe(hashStreamKey(k));
  });
  it("returns 64 hex chars (sha256)", () => {
    const k = generateStreamKey();
    const h = hashStreamKey(k);
    expect(h.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true);
  });
  it("different keys produce different hashes", () => {
    expect(hashStreamKey("a")).not.toBe(hashStreamKey("b"));
  });
});

describe("compareStreamKey", () => {
  it("matches a key against its own hash", () => {
    const k = generateStreamKey();
    expect(compareStreamKey(k, hashStreamKey(k))).toBe(true);
  });
  it("rejects a mismatched key", () => {
    const a = generateStreamKey();
    const b = generateStreamKey();
    expect(compareStreamKey(a, hashStreamKey(b))).toBe(false);
  });
  it("returns false on length mismatch (short hash)", () => {
    expect(compareStreamKey("anything", "deadbeef")).toBe(false);
  });
});
