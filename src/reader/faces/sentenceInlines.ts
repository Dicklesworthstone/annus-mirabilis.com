import type { Inline } from "../../content/schemas/inlines.ts";
import { plainText } from "../../content/schemas/inlines.ts";

/**
 * The inlines of one sentence of a block, cut at the sentence span's own offsets, for a face that
 * prints a sentence on its own (the gloss face's unglossed sentence, dispatch 207).
 *
 * WHY THIS EXISTS. The gloss face printed a sentence with no gloss unit as
 * `diplomaticText.slice(span)`, the block's plain text, where an inline formula is its TeX source.
 * On Brownian motion's partial gloss that put "V^*" (with its caret) in front of readers in 36 of the 87
 * unglossed sentences. These inlines go through renderInlines instead, so a formula is KaTeX.
 *
 * Offsets are code points over plainText(inlines), which is what a sentence span indexes. A text
 * node is cut at the span's bounds. Measured on 2026-09-25, no text node in the four papers'
 * blocks crosses a sentence boundary (0 of 542 sentence spans cut one), so keeping whole nodes,
 * as SourceBlock's private helper does, gives the same words today; the cut keeps a block whose
 * text node runs on into the next sentence from printing that sentence here. A display formula adds no characters
 * and is left out, as the gloss face sets each display after the sentence that prints it
 * (displayClaims.ts); so is a footnote mark, as that face prints no marks.
 */
export function sentenceInlines(
  inlines: readonly Inline[],
  span: Readonly<{ start: number; end: number }>,
): Inline[] {
  let offset = 0;
  const walk = (nodes: readonly Inline[]): Inline[] => {
    const out: Inline[] = [];
    for (const node of nodes) {
      if (node.kind === "emphasis") {
        const inner = walk(node.inlines);
        if (inner.length > 0) out.push({ ...node, inlines: inner });
        continue;
      }
      const length = Array.from(plainText([node])).length;
      const start = offset;
      const end = offset + length;
      offset = end;
      if (length === 0 || end <= span.start || start >= span.end) continue;
      if (node.kind === "footnote-mark") continue;
      if (node.kind === "text") {
        const text = Array.from(node.text)
          .slice(Math.max(0, span.start - start), Math.min(length, span.end - start))
          .join("");
        if (text) out.push({ ...node, text });
        continue;
      }
      out.push(node);
    }
    return out;
  };
  return walk(inlines);
}
