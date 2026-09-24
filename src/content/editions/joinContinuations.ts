/**
 * A PARAGRAPH BROKEN BY A PAGE IS ONE PARAGRAPH ON THE GERMAN FACE (TanElk's ruling, 2026-09-24:
 * "the splitting code is ours... change only how our code cuts it into paragraphs").
 *
 * The ledger ends a page's text with `[[CONTINUES]]` when its last paragraph runs on to the next
 * page (validateLedger.ts), usually at the end of the last line: "…wobei $\varphi$ eine Funktion
 * der Variabeln $\varrho$ und $\nu$[[CONTINUES]]". segmentLedger recognises the marker only on a
 * line of its own, and even then a footnote at the foot of the page flushes the paragraph, so the
 * next page's first line started a paragraph of its own. On the German face the reader saw
 * "bedeutet. Es kann…" open a new paragraph mid-sentence: measured on the segmenter's output, 9
 * such breaks in light quanta, 5 in Brownian motion, 1 in mass-energy and 13 in special
 * relativity. This joins them.
 *
 * NO ID MOVES. The join runs after segmentation, so every paragraph keeps the id it has today.
 * The continuation's id is retired, never reused, and listed on the joined paragraph as
 * `joinedIds`, which is the manifests' own rule for a merge (mass-energy: "s0-p8, s0-p9 and
 * s0-p10 retired (merged into s0-p7); ids are never reused and survivors keep their numbers").
 * The face renders each retired id as an anchor where the page turned, so a link to it still
 * lands on its words.
 *
 * The marker stays in the joined text where the page turned: the renderer drops it (sourceMarkup's
 * STRUCTURAL tokens), and it is how the face and the page map find each join.
 *
 * Only footnotes, and the continuation's own display equations (the segmenter emits a paragraph's
 * equations just before it), may stand between the two halves. A heading, a standalone equation
 * or a closing ends the chance to join, and the paragraph keeps its marker unjoined.
 */

import type { ProposedBlock, ProposedSentence } from "./segmentLedger.ts";
import { extractSentenceInlineMathIds, proposeSentences } from "./segmentSentences.ts";

export const CONTINUES = "[[CONTINUES]]";

export type JoinedBlock = ProposedBlock & Readonly<{ joinedIds?: readonly string[] | undefined }>;

function sentencesFor(id: string, text: string): readonly ProposedSentence[] {
  return Object.freeze(
    proposeSentences(text).map((s, k) => {
      const sentenceId = `${id}-s${k + 1}`;
      const mathIds = extractSentenceInlineMathIds(s.text, sentenceId);
      return {
        id: sentenceId,
        text: s.text,
        ...(mathIds.length > 0 ? { inlineMathIds: mathIds } : {}),
      };
    }),
  );
}

/** The index of the paragraph that continues `blocks[at]`, or -1 when nothing may join it. */
function continuationOf(blocks: readonly ProposedBlock[], at: number): number {
  for (let i = at + 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block || block.kind === "footnote") continue;
    if (block.kind === "paragraph") {
      const claimed = new Set(block.displayEquationIds ?? []);
      const between = blocks.slice(at + 1, i);
      return between.every((b) => b.kind === "footnote" || claimed.has(b.id)) ? i : -1;
    }
    if (block.kind === "equation") continue;
    return -1;
  }
  return -1;
}

export function joinPageContinuations(blocks: readonly ProposedBlock[]): readonly JoinedBlock[] {
  const out: JoinedBlock[] = [...blocks];
  for (let at = 0; at < out.length; at++) {
    let block = out[at];
    while (
      block?.kind === "paragraph" &&
      block.text.trimEnd().endsWith(CONTINUES) &&
      continuationOf(out, at) >= 0
    ) {
      const next = continuationOf(out, at);
      const continuation = out[next] as JoinedBlock;
      const text = `${block.text.trimEnd()} ${continuation.text}`;
      const equations = [
        ...(block.displayEquationIds ?? []),
        ...(continuation.displayEquationIds ?? []),
      ];
      block = {
        ...block,
        text,
        sentences: sentencesFor(block.id, text),
        ...(equations.length > 0 ? { displayEquationIds: Object.freeze(equations) } : {}),
        joinedIds: Object.freeze([
          ...((block as JoinedBlock).joinedIds ?? []),
          continuation.id,
          ...(continuation.joinedIds ?? []),
        ]),
      };
      out[at] = block;
      out.splice(next, 1);
    }
  }
  return Object.freeze(out);
}
