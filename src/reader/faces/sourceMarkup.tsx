/**
 * Ledger markup tokens become typography, instead of reaching the reader as text.
 *
 * The ledger is a diplomatic transcription, so it records the 1905 compositor's typography as
 * bracketed instructions rather than as styling: `[[SPERR]]…[[/SPERR]]` for Sperrsatz, the
 * letter-spaced emphasis German printers used where English printers used italics, `[[EM]]` for
 * italic, `[[FN-MARK 1)]]` for a printed footnote mark, `[[EQ-LABEL (1)]]` for a printed equation
 * number, and structural markers like `[[CONTINUES]]` for a paragraph broken across a page.
 *
 * Measured on the build of 2026-09-22 10:32:54, before this module existed: 285 of those tokens
 * were served as visible text on 15 pages, 116 on /papers/light-quanta/view/german alone, inside
 * Einstein's sentences - "die [[SPERR]]Maxwell-Hertzschen[[/SPERR]] Gleichungen". The German source
 * face is the one face the site claims is finished for three of the four papers.
 *
 * WHY HERE AND NOT UPSTREAM. The ledger and the source blocks are Einstein's words as printed and
 * are never edited to suit a renderer; the tokens are correct in the transcription and wrong on
 * the page. `tokenizeGerman.ts` is not the missing binding either - it is a WORD tokenizer for
 * gloss and alignment, and it deliberately SKIPS these tags so emphasis never splits a word. So
 * nothing in the pipeline was turning them into typography, and this is that step.
 *
 * SPERRSATZ IS EMPHASIS, NOT DECORATION, which is why it becomes `<em>` and not a styled `<span>`.
 * A reader using a screen reader should hear the stress Einstein's compositor set, and a reader
 * who disables CSS should still get it. The letter-spacing is the visual form of that emphasis and
 * lives in CSS; the meaning lives in the element.
 *
 * AN UNKNOWN TOKEN IS LEFT VISIBLE ON PURPOSE. If a twelfth form is added to the ledger grammar
 * tomorrow, this module does not recognise it, and the choice is between dropping it silently and
 * letting it through. Dropping wins on appearance and loses the thing that matters: a silently
 * deleted token is invisible to every check, while a visible one turns
 * scripts/e2e/sourceMarkupLeak.e2e.test.ts red and names the page. Visible-and-caught beats
 * silently-discarded, so unknown tokens pass through unchanged.
 */

import type { ReactNode } from "react";

/** `[[SPERR]]`, `[[/SPERR]]`, `[[FN-MARK 1)]]`, `[[EQ-LABEL (1)]]`. */
const TOKEN = /\[\[(\/?)([A-Z][A-Z-]*)(?:\s+([^\]]*))?\]\]/g;

/** Tags that wrap text and must be rendered as an element around their content. */
const PAIRED: Record<string, (children: ReactNode[], key: string) => ReactNode> = {
  // Sperrsatz. `lang` is inherited from the block, so no repetition here.
  SPERR: (children, key) => (
    <em key={key} className="source-sperr">
      {children}
    </em>
  ),
  EM: (children, key) => <em key={key}>{children}</em>,
};

/** Tags that stand alone and carry their printed text as an argument. */
const STANDALONE: Record<string, (arg: string | undefined, key: string) => ReactNode> = {
  // The mark as the compositor set it, "1)" and not a generated "1".
  "FN-MARK": (arg, key) => (
    <sup key={key} className="source-footnote-mark">
      {arg ?? ""}
    </sup>
  ),
  "EQ-LABEL": (arg, key) => (
    <span key={key} className="source-equation-label">
      {arg ?? ""}
    </span>
  ),
};

/**
 * Markers that describe the page rather than the prose, and carry no text a reader needs.
 *
 * `[[/DATELINE]]` and `[[/RECEIVED]]` appear here as orphans: segmentLedger.ts strips their
 * OPENING tag with a replace anchored at the start of the line, and leaves the closer behind,
 * which is why those two leaked exactly three times each while their openers leaked zero times.
 * Dropping them here is correct for the reader; the asymmetry upstream is reported separately
 * rather than repaired in the edition pipeline during a design pass.
 */
const STRUCTURAL = new Set(["CONTINUES", "DATELINE", "RECEIVED", "PAGE", "COL"]);

/**
 * Renders a ledger text string into React nodes, resolving markup into typography.
 *
 * Returns a plain string when the text carries no markup, so the overwhelming majority of blocks
 * cost nothing and render exactly as before.
 */
export function renderSourceMarkup(text: string, keyPrefix: string): ReactNode {
  if (!text.includes("[[")) return text;

  type Frame = { readonly tag: string | null; readonly children: ReactNode[] };
  const stack: Frame[] = [{ tag: null, children: [] }];
  const top = () => stack[stack.length - 1] as Frame;
  const push = (node: ReactNode) => top().children.push(node);

  let cursor = 0;
  let seq = 0;
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > cursor) push(text.slice(cursor, at));
    cursor = at + match[0].length;

    const closing = match[1] === "/";
    const name = match[2] ?? "";
    const arg = match[3];

    const paired = PAIRED[name];
    if (paired) {
      if (!closing) {
        stack.push({ tag: name, children: [] });
      } else if (stack.length > 1 && top().tag === name) {
        const frame = stack.pop() as Frame;
        push(paired(frame.children, `${keyPrefix}-m${seq++}`));
      }
      // An unmatched closer wraps nothing and is dropped rather than shown.
      continue;
    }

    const standalone = STANDALONE[name];
    if (standalone) {
      push(standalone(arg, `${keyPrefix}-m${seq++}`));
      continue;
    }

    if (STRUCTURAL.has(name)) continue;

    // Unrecognised: left visible so the leak check names it. See the docblock.
    push(match[0]);
  }
  if (cursor < text.length) push(text.slice(cursor));

  // An opener with no closer must not swallow the rest of the paragraph: unwrap it and keep the
  // text. The emphasis is lost, the words are not.
  while (stack.length > 1) {
    const frame = stack.pop() as Frame;
    top().children.push(...frame.children);
  }
  return (stack[0] as Frame).children;
}
