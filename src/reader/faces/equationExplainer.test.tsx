/**
 * "Explain this equation" under every printed display that has an explanation (dispatch 278), on
 * the German, English, parallel and results faces. Read from the rendered page, as a reader's
 * browser receives it:
 * - each display with a compiled explanation carries exactly one explainer, inside its own block;
 *   a display with none carries none, so no empty control is shown;
 * - the page carries one real link per equation and nothing else, since a closed panel shows nothing
 *   (dispatch 292): the words and the levels are fetched from a static fragment when a reader opens
 *   it, and the link is what a reader without JavaScript follows instead;
 * - every panel names a fragment that exists and holds the words and the levels the record fills;
 * - each In words phrase names a quantity whose glyph is in the same block, so hovering one lights
 *   the other (TermHighlight lights by exact quantity id within the block);
 * - nothing in it is a block element a paragraph may not hold, since most displays are set in a <p>.
 * The denominator is printed per face.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import payload from "../../generated/equation-explanations.json";
import fullPayload from "../../generated/equation-explanations-full.json";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

type Compiled = Readonly<{
  display: string;
  inWords: readonly Readonly<{ text: string; quantityId?: string }>[];
  levels?: readonly string[];
}>;
type Whole = Readonly<{ r2?: readonly unknown[] }>;
const PAPERS = (
  payload as unknown as { papers: Record<string, { displays: Record<string, Compiled> }> }
).papers;
const FULL = (
  fullPayload as unknown as {
    papers: Readonly<Record<string, { displays: Readonly<Record<string, Whole>> }>>;
  }
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
          // The levels are not in the page: a face carrying them stood at 992,203 bytes gzipped
          // against a recorded 385,289 (dispatch 292). The page names them and fetches their words.
          expect([id, explainer.querySelectorAll(".eq-level").length]).toEqual([id, 0]);
          expect([id, explainer.querySelectorAll(".eq-step").length]).toEqual([id, 0]);
          expect([id, !!explainer.querySelector(".eq-explain-levels")]).toEqual([id, true]);
          // The fragment it names exists, and holds every level the record fills.
          const url = explainer.getAttribute("data-explainer-fragment") ?? "";
          expect([id, url]).toEqual([id, `/equation-explanations/${paper}/${id}.json`]);
          const fragment = JSON.parse(readFileSync(join("public", url), "utf8")) as {
            levels: string[];
            html: string;
          };
          const filled = record.levels ?? [];
          expect([id, fragment.levels]).toEqual([id, [...filled]]);
          for (const level of filled)
            expect([id, level, fragment.html.includes(`data-level="${level}"`)]).toEqual([
              id,
              level,
              true,
            ]);
          // Nothing was lost in the split: the fragment holds every step the record compiled.
          const whole = FULL[paper]?.displays[id];
          expect([id, (fragment.html.match(/class="eq-step"/g) ?? []).length]).toEqual([
            id,
            whole?.r2?.length ?? 0,
          ]);
          // The control is itself a real link to the page that holds every level, which a reader
          // without JavaScript follows and a failed fetch falls back to.
          const link = explainer.querySelector("a.eq-explain-control");
          expect([id, link?.getAttribute("href")]).toEqual([id, `/equations/${paper}/${id}/`]);
          expect([id, explainer.querySelectorAll("input").length]).toEqual([id, 0]);
          // The equation in words travels with the levels, since a closed panel shows neither.
          expect([id, explainer.querySelectorAll(".eq-explain-words").length]).toEqual([id, 0]);
          expect([id, fragment.html.includes("eq-explain-words")]).toEqual([id, true]);
          // The words and the colours agree: each phrase's quantity has a glyph in this block.
          const glyphs = new Set(
            [...block.querySelectorAll(".katex [data-quantity-id]")]
              .filter((g) => !g.closest(".eq-explainer"))
              .map((g) => g.getAttribute("data-quantity-id")),
          );
          // Every phrase the fragment binds names a quantity this block's own formula carries, so
          // pointing at one lights the other once the words arrive. Read from the fragment's own
          // markup: a regex over it would also count the step formulas' coloured glyphs.
          const parsed = new Window().document;
          parsed.body.innerHTML = fragment.html;
          const bound = [...parsed.querySelectorAll(".eq-explain-words [data-quantity-id]")].map(
            (phrase) => phrase.getAttribute("data-quantity-id"),
          );
          expect([id, bound.length]).toEqual([
            id,
            record.inWords.filter((p) => p.quantityId).length,
          ]);
          for (const q of bound) expect([id, q, glyphs.has(q)]).toEqual([id, q, true]);
          // Phrasing content only, since the display may be set inside a <p>.
          expect([id, explainer.querySelectorAll(NOT_PHRASING).length]).toEqual([id, 0]);
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
