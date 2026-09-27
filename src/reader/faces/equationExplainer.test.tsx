/**
 * "Explain this equation" under every printed display that has an explanation (dispatch 278), on
 * the German, English, parallel and results faces. Read from the rendered page, as a reader's
 * browser receives it:
 * - each display with a compiled explanation carries exactly one explainer, inside its own block;
 *   a display with none carries none, so no empty control is shown;
 * - every level is in the static HTML: In words, Overview, Full explanation, Every step (one step per
 *   record step), and the Historian's margin where the record has one;
 * - each In words phrase names a quantity whose glyph is in the same block, so hovering one lights
 *   the other (TermHighlight lights by exact quantity id within the block);
 * - nothing in it is a block element a paragraph may not hold, since most displays are set in a <p>.
 * The denominator is printed per face.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import payload from "../../generated/equation-explanations.json";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

type Compiled = Readonly<{
  display: string;
  inWords: readonly Readonly<{ text: string; quantityId?: string }>[];
  r2: readonly unknown[];
  r3?: unknown;
}>;
const PAPERS = (
  payload as unknown as { papers: Record<string, { displays: Record<string, Compiled> }> }
).papers;
const FACES = ["german", "english", "parallel", "results"] as const;
const NOT_PHRASING = "div, p, ol, ul, li, details, summary, section, h1, h2, h3, h4, h5, h6, table";

describe("the equation explainer on the reading faces", () => {
  test("every display with an explanation carries one, with every level, and no other display does", async () => {
    const papers = Object.keys(PAPERS);
    // Not vacuous: the build compiled explanations for at least one paper.
    expect(papers.length).toBeGreaterThan(0);
    let checked = 0;
    for (const paper of papers) {
      const explained = PAPERS[paper]?.displays ?? {};
      for (const face of FACES) {
        const html = await exportMarkup(await PaperPage({ paperId: paper, face }));
        const { document } = new Window();
        document.body.innerHTML = html;
        const blocks = [...document.querySelectorAll(".printed-display-terms[data-display-terms]")];
        let withExplainer = 0;
        for (const block of blocks) {
          const id = block.getAttribute("data-display-terms") ?? "";
          const record = explained[id];
          const explainers = block.querySelectorAll(".eq-explainer");
          if (!record) {
            expect([id, explainers.length]).toEqual([id, 0]);
            continue;
          }
          expect([id, explainers.length]).toEqual([id, 1]);
          withExplainer++;
          const explainer = explainers.item(0);
          if (!explainer) throw new Error(`${id}: no explainer`);
          expect(explainer.getAttribute("data-explains")).toBe(id);
          expect(explainer.getAttribute("lang")).toBe("en");
          for (const level of ["0", "1", "2"])
            expect([
              id,
              level,
              !!explainer.querySelector(`.eq-level[data-level="${level}"]`),
            ]).toEqual([id, level, true]);
          expect(!!explainer.querySelector('.eq-level[data-level="3"]')).toBe(
            record.r3 !== undefined,
          );
          expect(explainer.querySelectorAll(".eq-step").length).toBe(record.r2.length);
          // The words and the colours agree: each phrase's quantity has a glyph in this block.
          const glyphs = new Set(
            [...block.querySelectorAll(".katex [data-quantity-id]")]
              .filter((g) => !g.closest(".eq-explainer"))
              .map((g) => g.getAttribute("data-quantity-id")),
          );
          const phrases = [...explainer.querySelectorAll(".eq-explain-words [data-quantity-id]")];
          expect(phrases.length).toBe(record.inWords.filter((p) => p.quantityId).length);
          for (const phrase of phrases) {
            const q = phrase.getAttribute("data-quantity-id");
            expect([id, q, glyphs.has(q)]).toEqual([id, q, true]);
          }
          // Phrasing content only, since the display may be set inside a <p>.
          expect([id, explainer.querySelectorAll(NOT_PHRASING).length]).toEqual([id, 0]);
          // Every toggle is a checkbox inside its own label, so it needs no id.
          for (const input of explainer.querySelectorAll("input"))
            expect([id, input.getAttribute("type"), input.closest("label") !== null]).toEqual([
              id,
              "checkbox",
              true,
            ]);
        }
        console.log(
          `${paper} ${face}: ${withExplainer} of ${blocks.length} printed displays explained on the page`,
        );
        checked += withExplainer;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
