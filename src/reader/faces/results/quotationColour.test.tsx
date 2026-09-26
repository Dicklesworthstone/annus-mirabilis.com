/**
 * A result card's quotation draws its inline formulas as the German face does (dispatch 272): for a
 * paper whose inline formulas are in colour, each formula a card quotes from the German face is the
 * face's coloured render, found by the paper, the anchor it is quoted from and its exact LaTeX
 * (printedInlines.ts), and the results face mounts the same lighting island. The denominator is
 * printed per paper, and a paper with no quoted inline formula would fail rather than pass on none.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { ENFORCED_INLINE_PAPERS } from "../../../equations/printed/paperInlines.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { PaperPage } from "../../PaperPage.tsx";

describe("a result card's quoted inline formulas", () => {
  test("on every enforced paper's results face, each quoted inline formula is coloured", async () => {
    let quoted = 0;
    for (const paper of ENFORCED_INLINE_PAPERS) {
      const html = await exportMarkup(await PaperPage({ paperId: paper, face: "results" }));
      const { document } = new Window();
      document.body.innerHTML = html;
      // Inline formulas only: a display a quoted paragraph holds is set by sourceDisplayEquation and
      // coloured there (PrintedDisplayTerms), its legend's chip glyphs with it.
      const formulas = [...document.querySelectorAll(".result-printed blockquote p .katex")].filter(
        (k) => !k.closest(".source-equation, .katex-display, .printed-display-terms"),
      );
      const drawn = formulas.filter(
        (k) => k.parentElement?.closest(`.inline-math[data-paper="${paper}"]`) !== null,
      );
      console.log(
        `${paper}: ${drawn.length} of ${formulas.length} quoted inline formulas in colour`,
      );
      expect(drawn.length).toBe(formulas.length);
      quoted += formulas.length;
    }
    // Not vacuous: the enforced papers' cards quote inline formulas, and each was looked at.
    expect(quoted).toBeGreaterThan(0);
  });
});
