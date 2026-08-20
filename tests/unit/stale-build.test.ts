import { describe, expect, it } from "vitest";

import { isChunkError } from "@/components/providers/stale-build-guard";

/**
 * Every bundler words this differently, and the cost of getting it wrong is
 * asymmetric: a missed match leaves a tab silently half working after a deploy,
 * while a false match costs one reload.
 */
describe("isChunkError", () => {
  it("recognises what the bundlers actually throw", () => {
    const chunkError = new Error(
      "Failed to load chunk /_next/static/chunks/14x_o97fsp~ur.js from module 162658",
    );
    chunkError.name = "ChunkLoadError";
    expect(isChunkError(chunkError)).toBe(true);

    expect(isChunkError(new Error("Loading chunk 42 failed"))).toBe(true);
    expect(
      isChunkError(new Error("error loading dynamically imported module: /a.js")),
    ).toBe(true);
    expect(isChunkError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkError("ChunkLoadError: something")).toBe(true);
    expect(isChunkError({ name: "ChunkLoadError" })).toBe(true);
  });

  it("leaves ordinary failures alone", () => {
    expect(isChunkError(new Error("Network request failed"))).toBe(false);
    expect(isChunkError(new TypeError("x is not a function"))).toBe(false);
    expect(isChunkError("Invalid password")).toBe(false);
    expect(isChunkError(null)).toBe(false);
    expect(isChunkError(undefined)).toBe(false);
    expect(isChunkError(404)).toBe(false);
  });
});
