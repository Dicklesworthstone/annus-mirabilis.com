/**
 * Which printed page the reader has reached: the page of the last block whose top is at or above
 * the reading line. Blocks are in document order, so their tops rise monotonically and the answer
 * is found by bisection, reading O(log n) rects per scroll frame rather than every block's.
 *
 * Above the first block (the title, the notice) the reader is still on the page the view opens
 * with, which the caller passes as `opening`.
 */
export type PagedBlock = Readonly<{
  getBoundingClientRect(): Readonly<{ top: number }>;
  dataset: Readonly<{ printedPage?: string | undefined }>;
}>;

export function pageAtLine(blocks: readonly PagedBlock[], line: number, opening: number): number {
  let lo = 0;
  let hi = blocks.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const block = blocks[mid] as PagedBlock;
    if (block.getBoundingClientRect().top <= line) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return opening;
  // An absent or empty attribute is not page 0: Number("") is 0, and 0 is an integer.
  const raw = (blocks[found] as PagedBlock).dataset.printedPage;
  const page = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(page) && page > 0 ? page : opening;
}
