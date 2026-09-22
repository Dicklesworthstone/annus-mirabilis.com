/**
 * Where does the donor attribution header end? Asked once, so five call sites cannot disagree.
 *
 * am-ftgq. There were two implementations of this one predicate and they gave opposite answers
 * on the same bytes:
 *
 *   validateAttributionHeader  content.startsWith("/**\n * Extracted from <donor>\n")
 *                             an exact prefix, so one leading newline means "header missing"
 *   every scanner's strip      content.match(/^\s*\/\*\*[\s\S]*?\*\//)
 *                             `\s*` admits leading whitespace, so the same header IS found
 *
 * Measured on src/types/pdfjs-dist.d.ts, a real extraction carrier, with two leading newlines
 * added in memory: the exact check said false and the strip said true. So the rights gate
 * refused a file for carrying no attribution notice while the donor-identity scanner in the
 * SAME MODULE found that notice, stripped it, and reported nothing.
 *
 * WHICH ANSWER WON, AND WHY IT IS THE PERMISSIVE ONE. `^\s*\/\*\*` is anchored at the start of
 * the string with no `m` flag, so the only thing it can admit before the block is WHITESPACE.
 * Content before the notice still produces no match, which is the case the bead warned about
 * when it said not to relax the prefix carelessly. Leading blank lines are a reformatting
 * artefact and not a missing licence; other content above the notice is a missing licence.
 * So the block is located permissively and its OPENING is still checked exactly.
 */

/** The header is the first non-whitespace block in the file, or there is no header. */
export const ATTRIBUTION_HEADER_PATTERN = /^\s*\/\*\*[\s\S]*?\*\//;

export interface AttributionHeader {
  /** The `/** ... *\/` block with its leading whitespace removed. */
  readonly block: string;
  /** Whatever whitespace preceded it, kept so a caller can report the real offset. */
  readonly leadingWhitespace: string;
  /** Index just past the block in the original content, for scanners that strip it. */
  readonly endIndex: number;
}

export function extractAttributionHeader(content: string): AttributionHeader | null {
  const match = ATTRIBUTION_HEADER_PATTERN.exec(content);
  const whole = match?.[0];
  if (whole === undefined) return null;
  const block = whole.trimStart();
  return {
    block,
    leadingWhitespace: whole.slice(0, whole.length - block.length),
    endIndex: whole.length,
  };
}

/**
 * Does the file's first block open with the required attribution line?
 *
 * This is the shared replacement for the exact `startsWith`. It is strict about the opening and
 * permissive about the whitespace before it, which is the only difference the two old
 * implementations ever had.
 */
export function attributionHeaderOpensWith(content: string, expectedOpening: string): boolean {
  return extractAttributionHeader(content)?.block.startsWith(expectedOpening) ?? false;
}
