/**
 * Where an mp4 keeps its index, read from the first slice of the file.
 *
 * An mp4 is a flat list of boxes: four bytes of size, four bytes of type, then
 * the payload. Two of them decide whether the file can stream. `moov` is the
 * index and `mdat` is the picture, and a player cannot decode a single frame
 * until it has read `moov`. Written index-first the file plays as it arrives;
 * written index-last the whole thing has to land first.
 *
 * The EVO TV filler was written index-last: 78 MB of 1440p120, `moov` at the
 * very end. The `<video>` tag downloaded silently, never decoded a frame, and
 * never raised an error, so the fallback never fired and off air showed a black
 * rectangle labelled "Back shortly". Nothing in the upload path could have
 * caught it, because nothing looked.
 *
 * The walk runs in the browser on the bytes a file input already holds, which
 * is why it is written against a plain `Uint8Array` and reads no more than the
 * caller hands it. The backend image carries no ffmpeg and the droplet has two
 * cores that are busy serving the channel, so remuxing server side would cost
 * both an image change and CPU on the box; the person uploading is standing
 * right there and can re-export.
 */

/**
 * What the head of the file says about the index.
 *
 * `unknown` is not a failure. It means the walk could not tell, which is the
 * answer for a webm, for a slice too short to reach either box, and for a file
 * whose boxes do not parse. Refusing a good upload on a guess is worse than
 * accepting one that is merely slow, so callers must treat it as "allow".
 */
export type Mp4Layout = "faststart" | "index-at-end" | "unknown";

/** Enough of the file to clear `ftyp` and reach the box after it. */
export const MP4_HEAD_BYTES = 1024 * 1024;

const HEADER_BYTES = 8;
/** A 64-bit size sits in the eight bytes after the type. */
const LARGE_SIZE_BYTES = 8;

function typeAt(head: Uint8Array, offset: number): string {
  let out = "";
  for (let i = offset; i < offset + 4; i += 1) out += String.fromCharCode(head[i]!);
  return out;
}

function uint32At(head: Uint8Array, offset: number): number {
  return (
    ((head[offset]! << 24) >>> 0) +
    (head[offset + 1]! << 16) +
    (head[offset + 2]! << 8) +
    head[offset + 3]!
  );
}

/**
 * Walk the top-level boxes until one of `moov` or `mdat` turns up.
 *
 * Whichever appears first is the answer, so a slice that stops deep inside a
 * huge `mdat` still gives a verdict: the index cannot be before a box that has
 * already gone past. That matters because the caller reads a megabyte of a file
 * that may be eighty.
 */
export function readMp4Layout(head: Uint8Array): Mp4Layout {
  if (head.length < HEADER_BYTES) return "unknown";
  // Every mp4-family file opens with `ftyp`. Anything else is a container this
  // walk does not understand, and it is not this function's job to judge it.
  if (typeAt(head, 4) !== "ftyp") return "unknown";

  let offset = 0;
  while (offset + HEADER_BYTES <= head.length) {
    const declared = uint32At(head, offset);
    const type = typeAt(head, offset + 4);

    if (type === "moov") return "faststart";
    // `mdat` first means the index is somewhere after it, whether or not this
    // slice reaches far enough to see it.
    if (type === "mdat") return "index-at-end";

    let size: number;
    if (declared === 1) {
      // 64-bit size. The high word is skipped: a box over 4 GiB runs past
      // anything the caller holds, so the walk would stop at the next test
      // regardless of what the high word says.
      if (offset + HEADER_BYTES + LARGE_SIZE_BYTES > head.length) return "unknown";
      const high = uint32At(head, offset + HEADER_BYTES);
      if (high !== 0) return "unknown";
      size = uint32At(head, offset + HEADER_BYTES + 4);
    } else if (declared === 0) {
      // "To the end of the file", so nothing follows it to look at.
      return "unknown";
    } else {
      size = declared;
    }

    // A size that cannot cover its own header would walk backwards or stand
    // still. Stop, and let the upload through rather than spin.
    if (size < HEADER_BYTES) return "unknown";
    offset += size;
  }

  return "unknown";
}

/**
 * Read the head of a picked file and say where its index is.
 *
 * Only the first slice is read, so picking an eighty megabyte file in the admin
 * form does not pull eighty megabytes through memory to answer the question.
 */
export async function readMp4LayoutOfFile(file: Blob): Promise<Mp4Layout> {
  const head = await file.slice(0, MP4_HEAD_BYTES).arrayBuffer();
  return readMp4Layout(new Uint8Array(head));
}
