import { describe, expect, it } from "vitest";

import { readMp4Layout } from "@/lib/media/mp4-faststart";

/**
 * The atom order in an mp4, and why a viewer sees black when it is wrong.
 *
 * An mp4 is a flat list of boxes: four bytes of size, four bytes of type, then
 * the payload. `moov` is the index and `mdat` is the picture. A browser cannot
 * decode a single frame until it has read `moov`, so a file that carries it
 * after `mdat` has to be downloaded whole before anything appears.
 *
 * The live EVO TV filler was exactly that: 78 MB with the index at the end. It
 * raised no error, so the fallback never fired, and the channel showed a black
 * rectangle labelled "Back shortly" for as long as the tab was open.
 */

/** One top-level box, with `size` covering the eight byte header. */
function atom(type: string, payloadBytes = 0): number[] {
  const size = 8 + payloadBytes;
  return [
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...new Array<number>(payloadBytes).fill(0),
  ];
}

/** A box whose real size lives in the eight bytes after the type. */
function largeAtom(type: string, payloadBytes = 0): number[] {
  const size = 16 + payloadBytes;
  return [
    0,
    0,
    0,
    1,
    ...[...type].map((c) => c.charCodeAt(0)),
    0,
    0,
    0,
    0,
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    ...new Array<number>(payloadBytes).fill(0),
  ];
}

function bytes(...parts: number[][]): Uint8Array {
  return new Uint8Array(parts.flat());
}

describe("readMp4Layout", () => {
  it("calls it faststart when the index comes before the picture", () => {
    const head = bytes(atom("ftyp", 24), atom("moov", 64), atom("mdat", 512));
    expect(readMp4Layout(head)).toBe("faststart");
  });

  it("calls it index-at-end when the picture comes first", () => {
    const head = bytes(atom("ftyp", 24), atom("free", 8), atom("mdat", 512), atom("moov", 64));
    expect(readMp4Layout(head)).toBe("index-at-end");
  });

  /*
   * The caller only ever holds the first slice of the file, so the answer has
   * to come from `mdat` arriving first rather than from finding `moov` late.
   * This is the real shape of the prod filler: the head ends deep inside a
   * 78 MB `mdat` and `moov` is off the end of what was read.
   */
  it("calls it index-at-end from the head alone, before moov is in view", () => {
    const head = bytes(atom("ftyp", 24), atom("free", 8), atom("mdat", 4096));
    expect(readMp4Layout(head.slice(0, 600))).toBe("index-at-end");
  });

  it("reads a 64-bit size so a large mdat does not stop the walk", () => {
    const head = bytes(atom("ftyp", 24), largeAtom("moov", 32), atom("mdat", 128));
    expect(readMp4Layout(head)).toBe("faststart");
  });

  /*
   * Size zero means "to the end of the file". Only `mdat` is written that way
   * in practice, and it means nothing follows it in the slice being read.
   */
  it("treats a size-zero mdat as the picture arriving first", () => {
    const head = bytes(atom("ftyp", 24), [0, 0, 0, 0, ...[..."mdat"].map((c) => c.charCodeAt(0))]);
    expect(readMp4Layout(head)).toBe("index-at-end");
  });

  /*
   * Unknown is not a failure, it is "do not block this upload". A webm or a
   * format this walk does not understand must not be refused on the strength of
   * a guess, because refusing a good file is worse than accepting a slow one.
   */
  it("says unknown for a file that is not mp4-shaped", () => {
    expect(readMp4Layout(bytes([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe("unknown");
  });

  it("says unknown when there is not enough of the file to tell", () => {
    expect(readMp4Layout(bytes(atom("ftyp", 24)))).toBe("unknown");
    expect(readMp4Layout(new Uint8Array(0))).toBe("unknown");
    expect(readMp4Layout(new Uint8Array([0, 0, 0]))).toBe("unknown");
  });

  /*
   * A declared size that cannot be true would otherwise walk backwards or sit
   * still and spin. The walk stops instead and the upload is allowed through.
   */
  it("says unknown rather than looping on a nonsense box size", () => {
    const head = bytes(atom("ftyp", 24), [0, 0, 0, 2, ...[..."junk"].map((c) => c.charCodeAt(0))]);
    expect(readMp4Layout(head)).toBe("unknown");
  });
});
