/**
 * "Explain this equation" on the explanation pages' model equations (dispatch 278, step 4). Read
 * from the rendered cards, as a reader's browser receives them:
 * - every model equation of the four papers carries the panel, since every record has the words to
 *   fill it: from the printed display it is bound to, or from its own sentence and explanation;
 * - the panel offers only the levels it has, and never an empty one: a card explained from its own
 *   record shows In words and the full explanation, and says so with data-only-level rather than
 *   obeying a page Detail it cannot answer;
 * - each In words phrase names a quantity the card's own formula binds, so pointing at one lights
 *   the other (the card lights by exact quantity id within itself);
 * - nothing in it is a block element, since a card's sentence and chips are phrasing content.
 * The denominator is printed: how many cards, and where each panel's words came from.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { ArgumentEquations } from "./ArgumentEquations.tsx";
import { paperEquations } from "./paperEquations.ts";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];
const NOT_PHRASING = "div, p, ol, ul, li, details, summary, section, h1, h2, h3, h4, h5, h6, table";

describe("the explainer on a model equation", () => {
  test("every model equation carries it, with the levels its words fill and no empty one", async () => {
    let cards = 0;
    let withPanel = 0;
    let fromDisplay = 0;
    let fromRecord = 0;
    for (const paper of PAPERS) {
      const equations = [...paperEquations(paper).values()];
      expect(equations.length).toBeGreaterThan(0);
      const argument = equations[0]?.argument;
      if (!argument) throw new Error(`${paper}: no argument to render`);
      // One argument's cards per paper: the whole set is the build census, printed below.
      const rendered = await ArgumentEquations({ paperId: paper, argumentId: argument });
      if (!rendered) throw new Error(`${paper}: ${argument} rendered nothing`);
      const html = await exportMarkup(rendered);
      const { document } = new Window();
      document.body.innerHTML = html;
      const own = equations.filter((e) => e.argument === argument);
      const cardsHere = [...document.querySelectorAll(".semantic-equation[data-equation-id]")];
      expect(cardsHere.length).toBe(own.length);
      for (const card of cardsHere) {
        cards++;
        // A card's id is the record's, with the scope it was rendered in appended
        // (SemanticEquation's equationId), so the record is the one whose id it begins with. Exactly
        // one must match: a prefix that fitted two records would name neither.
        const id = card.getAttribute("data-equation-id") ?? "";
        const matches = own.filter((e) => id === e.id || id.startsWith(`${e.id}-`));
        expect([id, matches.length]).toEqual([id, 1]);
        const equation = matches[0];
        const panels = [...card.querySelectorAll(".eq-explainer")];
        // Every card carries exactly one panel: every record has the words to fill one.
        expect([id, panels.length]).toEqual([id, 1]);
        const node = panels[0];
        if (!node) throw new Error(`${id}: no panel`);
        withPanel++;
        if (equation?.explainer?.display) fromDisplay++;
        else fromRecord++;
        // Only levels with words, and a single-level panel says which one it is, so the page's
        // Detail cannot open it empty.
        const levels = [...node.querySelectorAll(".eq-level")].map((l) =>
          l.getAttribute("data-level"),
        );
        expect([id, levels.length > 0]).toEqual([id, true]);
        const only = node.getAttribute("data-only-level");
        if (only === null) expect([id, levels.length > 1]).toEqual([id, true]);
        else expect([id, levels]).toEqual([id, [only]]);
        // Every phrase in words names a quantity this card's own formula binds.
        const glyphs = new Set(
          [...card.querySelectorAll("[data-quantity-id]")]
            .filter((g) => !g.closest(".eq-explainer"))
            .map((g) => g.getAttribute("data-quantity-id")),
        );
        for (const phrase of node.querySelectorAll(".eq-explain-words [data-quantity-id]")) {
          const q = phrase.getAttribute("data-quantity-id");
          expect([id, q, glyphs.has(q)]).toEqual([id, q, true]);
        }
        expect([id, node.querySelectorAll(NOT_PHRASING).length]).toEqual([id, 0]);
      }
      console.log(`${paper} ${argument}: ${cardsHere.length} model equations, each with its panel`);
    }
    console.log(
      `model equations rendered: ${withPanel} of ${cards} with the panel, ${fromDisplay} from a printed display's record, ${fromRecord} from their own`,
    );
    expect(withPanel).toBe(cards);
    expect(cards).toBeGreaterThan(0);
  });

  test("the whole corpus is explained: every model equation of every paper has its words", () => {
    let total = 0;
    let fromDisplay = 0;
    let fromRecord = 0;
    const bare: string[] = [];
    for (const paper of PAPERS)
      for (const equation of paperEquations(paper).values()) {
        total++;
        if (!equation.explainer) bare.push(equation.id);
        else if (equation.explainer.display) fromDisplay++;
        else fromRecord++;
      }
    console.log(
      `model equations: ${total} across the four papers, ${fromDisplay} explained from a printed display's record, ${fromRecord} from their own, ${bare.length} with neither`,
    );
    expect(bare).toEqual([]);
    expect(total).toBeGreaterThan(0);
  });
});
