/**
 * "Explain this equation" on the explanation pages' model equations (dispatch 278, step 4). Read
 * from the rendered cards, as a reader's browser receives them:
 * - every model equation of the four papers carries the panel, since every record has the words to
 *   fill it: from the printed display it is bound to, or from its own sentence and explanation;
 * - the panel names only the levels it has, and never an empty one: a card explained from its own
 *   record offers In words and the full explanation, and says so with data-only-level rather than
 *   obeying a page Detail it cannot answer. The levels themselves are fetched (dispatch 292);
 * - each In words phrase names a quantity the card's own formula binds, so pointing at one lights
 *   the other (the card lights by exact quantity id within itself);
 * - nothing in it is a block element, since a card's sentence and chips are phrasing content.
 * The denominator is printed: how many cards, and where each panel's words came from.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { fullExplanation } from "../equations/printed/fullExplanations.ts";
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
        // The levels are fetched, not carried (dispatch 292): the page names them, and a
        // single-level panel says which one it is so the page's Detail cannot open it empty.
        expect([id, node.querySelectorAll(".eq-level").length]).toEqual([id, 0]);
        const levels = equation?.explainer?.levels ?? [];
        expect([id, levels.length > 0]).toEqual([id, true]);
        const only = node.getAttribute("data-only-level");
        if (only === null) expect([id, levels.length > 1]).toEqual([id, true]);
        else expect([id, [...levels]]).toEqual([id, [only]]);
        // Its fragment exists, and its control is a real link for a reader without JavaScript.
        const url = node.getAttribute("data-explainer-fragment") ?? "";
        expect([id, url.startsWith("/equation-explanations/")]).toEqual([id, true]);
        expect([id, existsSync(join("public", url))]).toEqual([id, true]);
        expect([id, !!node.querySelector("a.eq-explain-control[href]")]).toEqual([id, true]);
        // Every phrase in words names a quantity this card's own formula binds.
        // The words travel with the levels, so the page carries none of them.
        expect([id, node.querySelectorAll(".eq-explain-words").length]).toEqual([id, 0]);
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

  // A FRAGMENT THAT EXISTS IS NOT A FRAGMENT THAT SAYS ANYTHING (dispatch 303). The case above
  // asserts the file is there, which is what a reader's panel fetches, and that passed while the
  // file held 209 bytes: the words, no levels, and none of the author's explanation. The levels are
  // named on the card and the prose lives only here and on the page, so this asserts the prose
  // itself arrives, by the two paths a reader has - the panel's fragment and the page's payload.
  test("a model equation's own explanation reaches both the fragment and the page", () => {
    let checked = 0;
    for (const paper of PAPERS)
      for (const equation of paperEquations(paper).values()) {
        const explainer = equation.explainer;
        // A card explained from a printed display's record shares that display's fragment, which the
        // reading faces' own test covers; this is about the records that have nowhere else to live.
        if (!explainer || explainer.display) continue;
        checked++;
        const id = equation.id;
        const levels = explainer.levels ?? [];
        // The record's own words give In words and the full explanation (modelExplanations.ts), so
        // level 1 is named on the card. A named level a reader cannot open is worse than none.
        expect([id, [...levels]]).toEqual([id, ["1"]]);
        const fragment = JSON.parse(
          readFileSync(join("public", "equation-explanations", paper, `${id}.json`), "utf8"),
        ) as { levels: string[]; html: string };
        expect([id, [...fragment.levels]]).toEqual([id, [...levels]]);
        expect([id, fragment.html.includes("Full explanation")]).toEqual([id, true]);
        // The author's prose, not a level name: the first words of the record's explanation, which
        // is the whole point of the level. Compared on text, so markup between the words cannot
        // hide a miss (the prose carries no mathematics: modelExplanations.ts).
        const { document } = new Window();
        document.body.innerHTML = fragment.html;
        const text = (document.body.textContent ?? "").replace(/\s+/g, " ");
        const opening = equation.explanation.trim().replace(/\s+/g, " ").slice(0, 60);
        expect([id, opening.length > 0]).toEqual([id, true]);
        expect([id, text.includes(opening)]).toEqual([id, true]);
        // The page a reader without JavaScript is given carries the same prose.
        const full = fullExplanation(paper, id);
        expect([id, full !== undefined]).toEqual([id, true]);
        const prose = (full?.r1 ?? []).map((part) => ("text" in part ? part.text : "")).join("");
        expect([id, prose.replace(/\s+/g, " ").includes(opening)]).toEqual([id, true]);
      }
    console.log(
      `model equations explained from their own record: ${checked}, each with its explanation in its fragment and on its page`,
    );
    expect(checked).toBeGreaterThan(0);
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
