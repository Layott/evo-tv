import { describe, expect, it } from "vitest";

import { formatFileSize } from "@/lib/media/file-size";

/**
 * How a file's size is said back to whoever picked it.
 *
 * This rounded to whole megabytes, so anything under half a megabyte read as
 * "0 MB". Caught on prod the day the faststart guard shipped: refusing a 44 KB
 * file produced "nothing appears until all 0 MB has downloaded", which reads as
 * a broken message rather than a size, and undercuts the very warning it is
 * carrying.
 */
describe("formatFileSize", () => {
  it("says kilobytes below a megabyte, never 0 MB", () => {
    expect(formatFileSize(44_933)).toBe("44 KB");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(500 * 1024)).toBe("500 KB");
  });

  /*
   * A handful of bytes is still not nothing. Rounding down to "0 KB" would
   * reintroduce the same fault one unit lower.
   */
  it("never rounds a real file down to zero", () => {
    expect(formatFileSize(1)).toBe("1 KB");
    expect(formatFileSize(400)).toBe("1 KB");
  });

  it("says megabytes at a megabyte and above", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(7_388_768)).toBe("7 MB");
    expect(formatFileSize(78_034_881)).toBe("74 MB");
  });

  /*
   * A megabyte-scale file keeps one decimal only where the whole number would
   * lose something worth knowing: 1.5 MB and 1 MB are different answers to
   * "is this too big".
   */
  it("keeps one decimal between one and ten megabytes", () => {
    expect(formatFileSize(Math.round(1.5 * 1024 * 1024))).toBe("1.5 MB");
    expect(formatFileSize(Math.round(9.4 * 1024 * 1024))).toBe("9.4 MB");
  });

  it("handles an empty file without inventing a size", () => {
    expect(formatFileSize(0)).toBe("0 KB");
  });
});
