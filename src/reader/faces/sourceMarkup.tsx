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
 *
 * THE MATHEMATICS IS TYPESET HERE TOO, for the same reason the tokens are. The ledger records
 * Einstein's formulas as TeX between `$…$` and `$$…$$`, which is correct in a transcription and
 * wrong on a page. Measured on the export of 2026-09-22 14:24:47 before this: 15 of the 28 built
 * /view/german/ pages served that TeX as text, 1,750 dollar signs and 2,584 control words,
 * "Bei der „schwarzen Strahlung“ ist $\varphi$ eine solche Funktion von $\nu$". The other 13 are
 * the twelve special-relativity notices and light-quanta §0, which has no mathematics.
 *
 * The regions are found by the SEGMENTER'S OWN grammar, `findDisplayMathRegions` and
 * `findInlineMathRegions`, not by a second parser. A display region here is exactly the region the
 * segmenter numbered, so the id it gave that equation can be put back on it. And each formula is
 * checked by `parseLedgerMath`, the ledger's KaTeX policy (no trust, no macro definitions, bounded
 * expansion), before it is rendered under the same settings. A formula that fails that check
 * THROWS: the build stops and names the formula. It is not shown as TeX and it is not replaced by
 * a placeholder, because malformed mathematics fails publication. All 409 formulas in the three
 * drafts pass today (102 display, 307 inline, measured with those two functions).
 */

import { renderToString } from "katex";
import type { ReactNode } from "react";
import {
  findDisplayMathRegions,
  findInlineMathRegions,
} from "../../content/editions/segmentSentences.ts";
import { LEDGER_KATEX_SETTINGS, parseLedgerMath } from "../../content/ledger/ledgerMathSettings.ts";
import { printedDisplay, printedDisplayInPaper } from "../../equations/printed/printedDisplays.ts";
import { printedInline } from "../../equations/printed/printedInlines.ts";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";
import "./sourceMarkup.css";

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
const STRUCTURAL = new Set(["CONTINUES", "JOINED", "DATELINE", "RECEIVED", "PAGE", "COL"]);

/**
 * A refusal to typeset the ledger. Both codes are build-time data failures, raised while the
 * static page is rendered, so the build stops and names the block rather than serving TeX or a
 * misplaced anchor:
 *   source-math-malformed        a formula fails the ledger's KaTeX policy (parseLedgerMath)
 *   source-display-ids-mismatch  a paragraph names a different number of display equations
 *                                than its text holds, so an id would land on the wrong formula
 */
export class SourceMarkupError extends Error {
  readonly code: "source-math-malformed" | "source-display-ids-mismatch";
  constructor(code: SourceMarkupError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "SourceMarkupError";
  }
}

/** One ledger formula as KaTeX HTML plus MathML, or a thrown error naming where it failed. */
function typesetLedgerMath(latex: string, displayMode: boolean, where: string): string {
  const check = parseLedgerMath(latex, displayMode);
  if (!check.ok) {
    throw new SourceMarkupError(
      "source-math-malformed",
      `Ledger mathematics at ${where} does not parse (${check.code}): ${check.error} :: ${latex}`,
    );
  }
  return renderToString(latex, {
    ...LEDGER_KATEX_SETTINGS,
    // A fresh object per call: KaTeX writes into it. See ledgerMathSettings.ts.
    macros: {},
    displayMode,
    output: "htmlAndMathml",
  });
}

/**
 * Text quoted from the German face elsewhere (a result card, dispatch 244): the paper it is from,
 * and the anchor it was quoted from, which settles a display the paper prints twice.
 */
export type Quotation = Readonly<{ paper: string; near?: string | undefined }>;

/**
 * A display formula, set on its own line with its printed number at the right, as the compositor
 * set it. `id` is the equation block's id from the segmenter, so an anchor to that equation lands
 * on the formula rather than on the paragraph around it.
 *
 * `source-equation` scrolls sideways when a formula is wider than a phone column. It carries no
 * tab stop of its own: the site-wide overflow script (formulaOverflow.inline.ts) gives one to the
 * formulas that actually overflow and to no others, so fifty display equations do not become fifty
 * stops a keyboard reader has to walk through.
 */
export function sourceDisplayEquation(
  latex: string,
  label: string | undefined,
  id: string | undefined,
  key: string,
  quoted?: Quotation,
): ReactNode {
  const plain = typesetLedgerMath(latex, true, id ?? key);
  // In colour where content/display-terms binds its glyphs and the ledger prints them alike
  // (PrintedDisplayTerms.tsx). The ledger's own parse check above still runs first. A quotation
  // (a result card's) has no id to find its colours by, and sets none: it is found by its paper
  // and LaTeX (printedDisplayInPaper), and the id stays with the German face.
  const printed =
    id === undefined && quoted
      ? printedDisplayInPaper(quoted.paper, latex, quoted.near)
      : printedDisplay(id, latex);
  const element = (
    <span
      key={printed ? undefined : key}
      id={id}
      className="source-equation"
      data-block-kind="equation"
    >
      <span
        className="source-equation-math"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output under the ledger's policy: no trust, no macros, parse checked first; or the same formula coloured by build-equations.ts, whose trust admits only its own term ids.
        dangerouslySetInnerHTML={{ __html: printed?.html ?? plain }}
      />
      {label ? <span className="source-equation-label">{label}</span> : null}
    </span>
  );
  return printed ? (
    <PrintedDisplayTerms key={key} display={printed} inline>
      {element}
    </PrintedDisplayTerms>
  ) : (
    element
  );
}

/**
 * Renders a ledger text string into React nodes, resolving markup into typography and TeX into
 * typeset mathematics.
 *
 * `displayIds` names the display equations this text contains, in printed order - a paragraph's
 * `displayEquationIds`. When given, it must name every one of them: an id put on the wrong formula
 * is a false anchor, so a count that disagrees with the text throws rather than guessing.
 *
 * `joins` names, in order, the paragraphs joined into this one, where a page turned or where the
 * print runs on after a display equation (joinContinuations.ts). The n-th `[[JOINED]]` in the text is the n-th join: it becomes an
 * empty anchor carrying the retired id and the printed page the words after it are on, so a link
 * to the old id lands there and the plate turns there. The ledger's own `[[CONTINUES]]` is dropped,
 * as every structural marker is, and so is a `[[JOINED]]` past the last join.
 *
 * Returns a plain string when the text carries neither markup nor mathematics, so most blocks
 * cost nothing and render exactly as before.
 */
export function renderSourceMarkup(
  text: string,
  keyPrefix: string,
  displayIds: readonly string[] = [],
  joins: readonly Readonly<{ id?: string | undefined; page?: number | undefined }>[] = [],
  quoted?: Quotation,
): ReactNode {
  if (!text.includes("[[") && !text.includes("$")) return text;

  const displays = findDisplayMathRegions(text);
  if (displayIds.length > 0 && displayIds.length !== displays.length) {
    throw new SourceMarkupError(
      "source-display-ids-mismatch",
      `${keyPrefix}: ${displayIds.length} display equation id(s) for ${displays.length} display formula(s) in the text`,
    );
  }
  type Region = Readonly<{
    start: number;
    end: number;
    latex: string;
    label: string | undefined;
    display: boolean;
    index: number;
  }>;
  const regions: Region[] = [
    ...displays.map((r, index) => ({ ...r, label: r.label, display: true, index })),
    ...findInlineMathRegions(text).map((r) => ({
      ...r,
      label: undefined,
      display: false,
      index: -1,
    })),
  ].sort((a, b) => a.start - b.start);

  type Frame = { readonly tag: string | null; readonly children: ReactNode[] };
  const stack: Frame[] = [{ tag: null, children: [] }];
  const top = () => stack[stack.length - 1] as Frame;
  const push = (node: ReactNode) => top().children.push(node);

  let seq = 0;
  let joined = 0;
  // Markup between formulas. The tag stack is shared across the formulas, so a [[SPERR]] pair
  // that encloses a formula still wraps it.
  const pushMarkup = (segment: string) => {
    let cursor = 0;
    for (const match of segment.matchAll(TOKEN)) {
      const at = match.index ?? 0;
      if (at > cursor) push(segment.slice(cursor, at));
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

      if (name === "JOINED" && !closing && joined < joins.length) {
        const join = joins[joined++];
        push(
          <span
            key={`${keyPrefix}-m${seq++}`}
            id={join?.id}
            data-page-join=""
            data-printed-page={join?.page}
          />,
        );
        continue;
      }
      if (STRUCTURAL.has(name)) continue;

      // Unrecognised: left visible so the leak check names it. See the docblock.
      push(match[0]);
    }
    if (cursor < segment.length) push(segment.slice(cursor));
  };

  let cursor = 0;
  for (const region of regions) {
    if (region.start > cursor) pushMarkup(text.slice(cursor, region.start));
    cursor = region.end;
    const key = `${keyPrefix}-m${seq++}`;
    if (region.display) {
      // The region's printed number, if any, was captured with it by the segmenter's grammar.
      push(
        sourceDisplayEquation(
          region.latex.trim(),
          region.label,
          displayIds[region.index],
          key,
          quoted,
        ),
      );
    } else {
      // Checked under the ledger's policy whether or not it is drawn in colour.
      const plain = typesetLedgerMath(region.latex, false, key);
      // A card's quotation of a paper drawn in colour (dispatch 272): the German face's own coloured
      // render, found by the paper, the anchor quoted and the exact LaTeX (printedInlines.ts). Only
      // a coloured formula carries the faces' class and data, so the lighting island finds it.
      const coloured = quoted ? printedInline(quoted.paper, quoted.near, region.latex) : undefined;
      push(
        <span
          key={key}
          {...(coloured && quoted
            ? {
                className: "inline-math",
                "data-paper": quoted.paper,
                ...(coloured.terms.length > 0 ? { "data-inline-terms": "" } : {}),
              }
            : {})}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output under the ledger's policy (no trust, no macros, parse checked first), or the build's coloured render of the same formula (inlineTerms.ts), whose MathML is checked equal to the plain render's.
          dangerouslySetInnerHTML={{ __html: coloured?.html ?? plain }}
        />,
      );
    }
  }
  if (cursor < text.length) pushMarkup(text.slice(cursor));

  // An opener with no closer must not swallow the rest of the paragraph: unwrap it and keep the
  // text. The emphasis is lost, the words are not.
  while (stack.length > 1) {
    const frame = stack.pop() as Frame;
    top().children.push(...frame.children);
  }
  return (stack[0] as Frame).children;
}
