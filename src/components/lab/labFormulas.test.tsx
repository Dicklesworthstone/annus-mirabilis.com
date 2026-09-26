/**
 * A laboratory's formulas are coloured in its paper's notation, or name the glyphs that stop them
 * (dispatch 274).
 *
 * Each lab page is rendered as the static export renders it, and every formula it prints through
 * LabFormula or LabInlineFormula is one of three things:
 * - coloured: inside the paper's data-paper island, with at least one term marked by quantity;
 * - resolved with nothing to colour: every atom an operator or a declared non-quantity
 *   (data-lab-formula-bound="none");
 * - refused: printed as before, naming the glyphs the resolver could not bind in the lab's scope
 *   (data-inline-refused). These are the gaps the concordance and the exceptions still have to
 *   close, and this file prints them per lab.
 * A formula that is none of these is plain in silence, and fails here.
 *
 * The labs are those converted so far, named here so a lab that loses its formulas fails.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import type { ReactElement } from "react";
import { labFormula, labScope } from "../../equations/printed/labInlines.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";

const LABS = [
  "lq-01",
  "lq-02",
  "lq-04",
  "lq-06",
  "lq-08",
  "lq-09",
  "bm-01",
  "bm-02",
  "bm-03",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-07",
  "bm-08",
  "sr-01",
  "sr-02",
  "sr-03",
  "sr-05",
  "sr-06",
  "sr-07",
  "sr-08",
  "sr-09",
  "sr-10",
  "sr-11",
  "sr-12",
  "sr-13",
  "me-01",
  "me-02",
  "me-03",
] as const;

/** How many LabFormula and LabInlineFormula sites the lab's page source holds. */
function sourceSites(lab: string): number {
  const text = readFileSync(join("src/app/lab", lab, "page.tsx"), "utf8");
  return (text.match(/<Lab(?:Inline)?Formula\b/g) ?? []).length;
}

async function page(lab: string) {
  const route = (await import(join(process.cwd(), "src/app/lab", lab, "page.tsx"))) as {
    default: (props: unknown) => ReactElement | Promise<ReactElement>;
  };
  const html = await exportMarkup(
    await route.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }),
  );
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

describe("a lab's formulas are coloured in its paper's notation, or name their gaps", () => {
  for (const lab of LABS)
    test(`${lab}: every formula is coloured, has nothing to colour, or names its unbound glyphs`, async () => {
      const document = await page(lab);
      const formulas = [...document.querySelectorAll(`[data-lab-formula="${lab}"]`)];
      const coloured = formulas.filter(
        (f) =>
          f.classList.contains("printed-display-terms") &&
          f.getAttribute("data-paper") === labScope(lab)?.paper &&
          f.querySelector("[data-quantity-id]") !== null,
      );
      const bare = formulas.filter((f) => f.getAttribute("data-lab-formula-bound") === "none");
      const refused = formulas.filter((f) => (f.getAttribute("data-inline-refused") ?? "") !== "");
      const silent = formulas.filter(
        (f) => !coloured.includes(f) && !bare.includes(f) && !refused.includes(f),
      );
      // Every site the page's source holds renders at least once.
      expect(formulas.length).toBeGreaterThanOrEqual(sourceSites(lab));
      expect(sourceSites(lab)).toBeGreaterThan(0);
      expect(silent.map((f) => f.getAttribute("data-latex"))).toEqual([]);
      const gaps = [
        ...new Set(refused.flatMap((f) => f.getAttribute("data-inline-refused")?.split(" ") ?? [])),
      ];
      console.log(
        `[labFormulas] ${lab}: ${formulas.length} formulas, ${coloured.length} coloured, ${bare.length} nothing to colour, ${refused.length} refused; unbound: ${gaps.join(" ")}`,
      );
    });

  test("the converted labs colour some formulas: the resolver reaches them", async () => {
    let coloured = 0;
    for (const lab of LABS) {
      const document = await page(lab);
      coloured += document.querySelectorAll(
        `.printed-display-terms[data-lab-formula="${lab}"] [data-quantity-id]`,
      ).length;
    }
    expect(coloured).toBeGreaterThan(0);
  });

  test("plant: a glyph the lab's scope does not bind is refused, naming its lab and the glyph", () => {
    const result = labFormula("lq-08", String.raw`\Xi_{\text{plant}} = 1`, false);
    expect(result.kind).toBe("refused");
    if (result.kind !== "refused") return;
    expect(result.problems.some((p) => p.where === "lab lq-08" && p.glyph.includes("\\Xi"))).toBe(
      true,
    );
  });
});
