/**
 * THE ONE PROSE LOOP THE EXPLAINER FAMILIES SHARE (am-hk4b).
 *
 * `equationExplanations.ts` and `labExplanations.ts` each carried a copy of this loop, and the
 * second said so in its own docblock: "THE PROSE LOOP IS A MIRROR of the one in
 * equationExplanations.ts ... The two loops must move together: a change to how `$...$` is found,
 * compiled or voice-checked belongs in both. Extracting them into one helper waits on a THIRD USE,
 * which is this repository's rule for a shared abstraction."
 *
 * THE DISCOVERY JOURNEYS ARE THAT THIRD USE, so the extraction happens here rather than a third
 * copy landing. The two copies were still true mirrors when this was written, which is what made it
 * mechanical: thirty lines differing in exactly two ways, and both are now parameters.
 *
 *   1. `labelled` on a math part. `equationExplanations` carried it and `labExplanations` did not.
 *      It is spread conditionally here, so a `draw` that never sets it produces the identical
 *      object -- and the identical JSON, since an absent key is not an undefined one.
 *   2. The refusal. Each family reports a voice error with its own code and its own message shape,
 *      so the finding is handed back rather than reported here.
 *
 * BYTE IDENTITY WAS THE ACCEPTANCE TEST, not the test suites, and it is why this is safe to do to
 * two families that serve readers today. `scripts/build-equations.ts` is deterministic -- no clock,
 * and a `rendererDigest` over its inputs -- so the 65 files of `src/generated/` were snapshotted
 * before the extraction and compared after. Identical, including key order, which a shared loop
 * that merely passed both suites would not have proved.
 *
 * It takes a `draw` rather than a formula resolver because that is the whole of what differs
 * between the families: a printed display reads in its paper's scope, a lab formula in its lab's,
 * and a journey formula in its step's.
 */

import { checkVoice, type VoiceFinding } from "../../content/checks/voice/index.ts";
import { findInlineMathRegions } from "../../content/editions/segmentSentences.ts";
import type { ProsePart } from "./equationExplanations.ts";

/** A formula drawn for a prose region: its HTML, and whether it carries colour or a label. */
export type DrawnFormula = Readonly<{
  html: string;
  coloured: boolean;
  labelled?: boolean | undefined;
}>;

/**
 * Draw one formula in the caller's scope, or report its own refusal and return undefined.
 *
 * `displayMode` is false for a formula inside a sentence and true for a step's own formula, which
 * is the only distinction the loop makes about where a formula sits.
 */
export type DrawFormula = (
  latex: string,
  field: string,
  displayMode: boolean,
) => DrawnFormula | undefined;

/**
 * One authored string as alternating words and drawn formulas, voice-checked as a whole.
 *
 * THE VOICE CHECK READS THE WORDS, NOT THE SOURCE, and the assembly is why: a `$...$` region is
 * replaced by a single space before `checkVoice` sees it, so a rule cannot match across a formula
 * and cannot fuse the words on either side of one into a phrase the author never wrote. That is the
 * same reasoning the TSX extractor reached under am-dbpk, where a sentence split by an inline
 * element was judged in fragments.
 */
export function compileProse(
  value: string,
  field: string,
  draw: DrawFormula,
  reportVoice: (finding: VoiceFinding, field: string) => void,
): ProsePart[] {
  const parts: ProsePart[] = [];
  let cursor = 0;
  let words = "";
  for (const region of findInlineMathRegions(value)) {
    if (region.start > cursor) {
      parts.push({ kind: "text", text: value.slice(cursor, region.start) });
      words += value.slice(cursor, region.start);
    }
    words += " ";
    const drawn = draw(region.latex, field, false);
    if (drawn !== undefined)
      parts.push({
        kind: "math",
        html: drawn.html,
        ...(drawn.coloured ? { coloured: true } : {}),
        ...(drawn.labelled ? { labelled: true } : {}),
      });
    cursor = region.end;
  }
  if (cursor < value.length) {
    parts.push({ kind: "text", text: value.slice(cursor) });
    words += value.slice(cursor);
  }
  for (const finding of checkVoice(words, { context: "prose" }))
    if (finding.severity === "error") reportVoice(finding, field);
  return parts;
}
