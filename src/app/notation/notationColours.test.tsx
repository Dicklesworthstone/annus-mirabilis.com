/**
 * EVERY FORMULA ON /notation/ IS DRAWN IN ITS PAPER'S COLOURS, OR SAYS WHY NOT (dispatch 275).
 *
 * The owner: "I still see a ton of equations that aren't properly using the colored equations with
 * latex system like in classic-patents.com". On the built page of b16bc66b, /notation/ drew 556
 * formulas and coloured none (math-census.py). This renders the page as the static export does and
 * reads every KaTeX formula on it:
 * - COLOURED: it marks a quantity (data-quantity-id) that the registry holds, inside an element
 *   naming its paper (data-paper), and quantity-colours-by-paper.css gives that pair a colour, so
 *   the mark is seen as a colour and not merely present;
 * - LISTED: it is left in the ink inside an element that says why (data-formula-plain): a form the
 *   concordance declares no quantity, a glyph with several meanings, or a quantity the paper's
 *   palette gives no colour;
 * - anything else fails, naming the formula's place on the page.
 * The registry and the stylesheet are read here from their own sources, not from the page.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { NotationFormulaError, notationFormula } from "./colouredGlyphs.ts";
import { loadNotationPageData } from "./notationData.ts";
import NotationPage from "./page.tsx";

const colours = readFileSync(
  join(process.cwd(), "src", "generated", "quantity-colours-by-paper.css"),
  "utf8",
);
const colourRule = (paper: string, quantityId: string) =>
  colours.includes(`[data-paper="${paper}"] [data-quantity-id="${quantityId}"]`);

type Census = { formulas: number; coloured: number; listed: number; problems: string[] };

/** Every KaTeX formula of a page's markup, as coloured, listed, or a problem. */
function census(html: string): Census {
  const { document } = new Window();
  // Both views are read: the page with JavaScript, and what <noscript> adds without it.
  document.body.innerHTML = html.replace(/<(\/?)noscript>/g, "<$1div>");
  const roots = [...document.querySelectorAll(".katex")].filter(
    (el) => !el.parentElement?.closest(".katex"),
  );
  const out: Census = { formulas: roots.length, coloured: 0, listed: 0, problems: [] };
  for (const root of roots) {
    const tex = root.querySelector("annotation")?.textContent ?? root.textContent ?? "";
    const where = `${root.closest("[id]")?.id ?? "(no id)"} ${JSON.stringify(tex.slice(0, 40))}`;
    const marked = [...root.querySelectorAll("[data-quantity-id]")].map(
      (el) => el.getAttribute("data-quantity-id") ?? "",
    );
    if (marked.length > 0) {
      const paper = root.closest("[data-paper]")?.getAttribute("data-paper") ?? "";
      const unseen = marked.filter(
        (q) => !paper || !isRegisteredQuantityId(q) || !colourRule(paper, q),
      );
      if (unseen.length === 0) out.coloured++;
      else
        out.problems.push(
          `${where}: marks ${unseen.join(", ")}, with no colour in ${paper || "no paper"}`,
        );
      continue;
    }
    const reason = root.closest("[data-formula-plain]")?.getAttribute("data-formula-plain");
    if (reason) out.listed++;
    else out.problems.push(`${where}: neither coloured nor listed with a reason`);
  }
  return out;
}

describe("every formula on /notation/ is in its paper's colours, or says why not", () => {
  test("the page: every formula coloured or listed", async () => {
    const page = census(await exportMarkup(await NotationPage()));
    console.log(
      `[notation colours] ${page.formulas} formulas: ${page.coloured} coloured, ${page.listed} listed; ${page.problems.length} problems`,
    );
    expect(page.problems).toEqual([]);
    // Not vacuous: the page draws formulas of both kinds.
    expect(page.coloured).toBeGreaterThan(0);
    expect(page.listed).toBeGreaterThan(0);
  });

  test("every quantity the page draws is one the registry holds", () => {
    // The page checks registration against the generated labels (the registry cannot be bundled);
    // here the registry itself reads every entry, symbol and form.
    expect(() => loadNotationPageData(undefined, undefined, isRegisteredQuantityId)).not.toThrow();
  });

  test("a form of several atoms is one term in its entry's quantity; a declared form stays plain", () => {
    const data = loadNotationPageData(undefined, undefined, isRegisteredQuantityId);
    const entry = (id: string) => data.allEntries.find((e) => e.id === id);
    // Mass-energy's L/2 is the energy of each pulse the body sends out: one expression, bound as a
    // whole to the entry's quantity (its binding, read here, is the rest-frame energy at scale 1/2).
    const halfEntry = entry("me.half_L.emittedPulseEnergy");
    const bound = (halfEntry?.binding as { quantityId?: string } | undefined)?.quantityId;
    expect(bound).toBeDefined();
    const half = halfEntry?.glyphRendered;
    expect(half?.quantityId).toBe(bound);
    expect(half?.html.match(/data-quantity-id="[^"]+"/g)).toEqual([`data-quantity-id="${bound}"`]);
    // Brownian's nu is an index: the concordance declares it no quantity, and it stays plain.
    const nu = entry("bm.nu.index")?.glyphRendered;
    expect(nu?.html).not.toContain("data-quantity-id");
    expect(nu?.plain).toContain("declares it no quantity");
  });

  test("a quantity the registry does not hold is refused, naming the page and the entry", () => {
    let caught: unknown;
    try {
      notationFormula(
        {
          id: "me.L.plantedQuantity",
          paper: "mass-energy",
          anchor: "s0-p4",
          latex: "L",
          quantityId: "notAQuantity",
        },
        isRegisteredQuantityId,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(NotationFormulaError);
    expect((caught as NotationFormulaError).code).toBe("notation-formula-unregistered-quantity");
    expect(String((caught as Error).message)).toContain("/notation/");
    expect(String((caught as Error).message)).toContain("me.L.plantedQuantity");
  });

  test("the census itself fails a formula neither coloured nor listed", () => {
    // The census is the gate, so it is shown to fail: a bare formula, and a marked one with no
    // paper, each name their place.
    const bare = census(
      '<div id="plant-a"><span class="katex"><span class="katex-mathml"><math><annotation>x</annotation></math></span></span></div>',
    );
    expect(bare.problems).toEqual(['plant-a "x": neither coloured nor listed with a reason']);
    const nopaper = census(
      '<div id="plant-b"><span class="katex"><span data-quantity-id="emittedPulseEnergy">L</span></span></div>',
    );
    expect(nopaper.problems.length).toBe(1);
    expect(nopaper.problems[0]).toContain("plant-b");
  });
});
