import type { OfflineManifest } from "../../platform/offline/server.ts";

/**
 * What /offline/ can say about the chapters it offers, from the manifest and nothing else.
 *
 * Every field here is a manifest field or a sum of one: `bytes` and `gzipBytes` per chapter,
 * `paper` and `section` for the coverage question. The page prints these rather than a number
 * typed into prose, so a chapter added or dropped changes the sentence with it. Nothing here
 * reads a chapter file: the size a reader is promised is the size the manifest recorded when the
 * file was written, which is also the size `loadOfflineChapter` refuses on if the bytes differ.
 */
export type OfflineFacts = Readonly<{
  chapters: number;
  papers: number;
  totalBytes: number;
  totalGzipBytes: number;
  smallestBytes: number;
  largestBytes: number;
  smallestGzipBytes: number;
  largestGzipBytes: number;
  /**
   * True when every paper's chapters run s0, s1, … with no gap, so "one for each section" is a
   * claim the manifest supports. A paper that published half its sections, or a section id this
   * pattern does not recognize, makes it false and the page drops the claim rather than
   * overstating what is there. That the top section number is also the paper's LAST section is
   * not visible here; page.test.tsx checks that against the source-block manifests on disk.
   */
  contiguousSections: boolean;
}>;

const SECTION = /^s(\d+)$/u;

export function offlineFacts(manifest: OfflineManifest | null): OfflineFacts | null {
  const chapters = manifest?.chapters ?? [];
  if (chapters.length === 0) return null;
  const papers = new Set(chapters.map((entry) => entry.paper));
  let contiguousSections = true;
  for (const paper of papers) {
    const numbers = chapters
      .filter((entry) => entry.paper === paper)
      .map((entry) => SECTION.exec(entry.section)?.[1])
      .map((digits) => (digits === undefined ? Number.NaN : Number(digits)))
      .sort((a, b) => a - b);
    if (numbers.some((value, index) => value !== index)) contiguousSections = false;
  }
  let totalBytes = 0;
  let totalGzipBytes = 0;
  let smallestBytes = Number.POSITIVE_INFINITY;
  let largestBytes = 0;
  let smallestGzipBytes = Number.POSITIVE_INFINITY;
  let largestGzipBytes = 0;
  for (const entry of chapters) {
    totalBytes += entry.bytes;
    totalGzipBytes += entry.gzipBytes;
    smallestBytes = Math.min(smallestBytes, entry.bytes);
    largestBytes = Math.max(largestBytes, entry.bytes);
    smallestGzipBytes = Math.min(smallestGzipBytes, entry.gzipBytes);
    largestGzipBytes = Math.max(largestGzipBytes, entry.gzipBytes);
  }
  return Object.freeze({
    chapters: chapters.length,
    papers: papers.size,
    totalBytes,
    totalGzipBytes,
    smallestBytes,
    largestBytes,
    smallestGzipBytes,
    largestGzipBytes,
    contiguousSections,
  });
}
