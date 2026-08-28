/**
 * A file's size, said the way a person would say it.
 *
 * This used to round to whole megabytes wherever it was used, which was fine
 * for the episode uploads it was written for and wrong everywhere else: a
 * 44 KB file came back as "0 MB". That surfaced on prod the day the faststart
 * guard shipped, in the sentence "nothing appears until all 0 MB has
 * downloaded", where a size that reads as a bug undercuts the warning carrying
 * it.
 *
 * So the unit follows the file rather than the other way round, and nothing
 * real is ever rounded down to zero.
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 KB";

  const kb = bytes / 1024;
  // A file smaller than a kilobyte is still a file. Say the smallest unit
  // rather than nothing.
  if (kb < 1) return "1 KB";
  if (kb < 1024) return `${Math.round(kb)} KB`;

  const mb = kb / 1024;
  // Between one and ten megabytes the decimal is the whole answer to "is this
  // too big"; above that the whole number is enough.
  if (mb < 10) {
    const rounded = Math.round(mb * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} MB`;
  }
  return `${Math.round(mb)} MB`;
}
