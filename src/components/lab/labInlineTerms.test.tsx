/**
 * A lab page's formulas light as the reading faces' do (dispatch 274): the build reads every
 * LabFormula and LabInlineFormula site from the pages' JSX (labFormulaSites.ts), gives their
 * quantities colour slots with the faces' inline formulas and their facts to the page's island
 * (build-equations.ts, lab-inlines.json), and each lab page mounts that island (LabInlineTerms).
 *
 * What would go wrong without each check:
 * - a site the parser misses has no slot, so two of its quantities may share a colour, and no facts;
 * - a quantity with no facts opens no inspector when pinned;
 * - a page without the island lights nothing beyond the one formula;
 * - a shared slot draws two quantities of one formula in one colour.
 * Run after prepare:content, which writes the generated files, as every lane does.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import type { ReactElement } from "react";
import ts from "typescript";
import { attachInlineLighting } from "../../equations/InlineTermLighting.tsx";
import {
  LabFormulaSiteError,
  labFormulaSites,
  labFormulaSitesOf,
} from "../../equations/printed/labFormulaSites.ts";
import { labFormula } from "../../equations/printed/labInlines.ts";
import payload from "../../generated/lab-inlines.json";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";

const LABS_FACTS = (
  payload as unknown as {
    labs: Readonly<
      Record<string, Readonly<{ paper: string; quantities: Record<string, unknown> }>>
    >;
  }
).labs;

const SITES = labFormulaSites();
const LABS = [...new Set(SITES.map((s) => s.lab))];

async function markup(lab: string): Promise<string> {
  const route = (await import(join(process.cwd(), "src/app/lab", lab, "page.tsx"))) as {
    default: (props: unknown) => ReactElement | Promise<ReactElement>;
  };
  return exportMarkup(
    await route.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }),
  );
}

async function page(lab: string) {
  const { document } = new Window();
  document.body.innerHTML = await markup(lab);
  return document;
}

/** The (display, latex) of every formula a page draws through LabFormula or LabInlineFormula. */
function drawn(document: Awaited<ReturnType<typeof page>>, lab: string): Set<string> {
  return new Set(
    [...document.querySelectorAll(`[data-lab-formula="${lab}"]`)].map((f) => {
      const holder = f.hasAttribute("data-latex") ? f : f.querySelector("[data-latex]");
      return `${holder?.tagName.toLowerCase() === "div"}|${holder?.getAttribute("data-latex")}`;
    }),
  );
}

describe("the build reads every lab formula the pages draw", () => {
  test("the sites cover the converted labs", () => {
    // 29 labs are converted; a parser that found none would pass every check below vacuously.
    expect(LABS.length).toBeGreaterThanOrEqual(29);
    expect(SITES.length).toBeGreaterThan(200);
  });

  for (const lab of ["lq-06", "bm-03", "sr-03", "me-01"])
    test(`${lab}: the parsed sites are exactly the formulas the page draws`, async () => {
      const parsed = new Set(
        SITES.filter((s) => s.lab === lab).map((s) => `${s.display}|${s.latex}`),
      );
      expect([...drawn(await page(lab), lab)].sort()).toEqual([...parsed].sort());
    });

  test("a quoted formula is read as printed, and a String.raw keeps its backslashes", () => {
    const [site] = labFormulaSitesOf(
      'const x = <LabFormula lab="bm-03" printed latex={String.raw`\\frac{a}{b}`} />;',
      "fixture.tsx",
    );
    expect(site).toMatchObject({
      lab: "bm-03",
      latex: "\\frac{a}{b}",
      display: true,
      printed: true,
    });
    const [inline] = labFormulaSitesOf(
      'const y = <LabInlineFormula lab="lq-09" latex="10\\text{ Volts}" />;',
      "fixture.tsx",
    );
    expect(inline).toMatchObject({ latex: "10\\text{ Volts}", display: false, printed: false });
  });

  test("a site whose latex is not a literal is refused by name (lab-formula-site-not-literal)", () => {
    let code = "accepted";
    try {
      labFormulaSitesOf('const z = <LabFormula lab="sr-05" latex={tex} />;', "fixture.tsx");
    } catch (error) {
      expect(error).toBeInstanceOf(LabFormulaSiteError);
      code = (error as LabFormulaSiteError).code;
      expect((error as Error).message).toContain("fixture.tsx:1");
    }
    expect(code).toBe("lab-formula-site-not-literal");
  });
});

describe("a lab page lights as the faces do", () => {
  test("every lab with a coloured formula mounts the island, with facts for each of its quantities", async () => {
    const missingIsland: string[] = [];
    const missingFacts: string[] = [];
    let coloured = 0;
    for (const lab of LABS) {
      const document = await page(lab);
      const quantities = new Set(
        [
          ...document.querySelectorAll(
            `[data-lab-formula="${lab}"][data-paper] [data-quantity-id]`,
          ),
        ].map((e) => e.getAttribute("data-quantity-id") as string),
      );
      if (quantities.size === 0) continue;
      coloured++;
      const source = ts.createSourceFile(
        "page.tsx",
        readFileSync(join("src/app/lab", lab, "page.tsx"), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      let mounted = false;
      const visit = (node: ts.Node) => {
        if (
          ts.isJsxSelfClosingElement(node) &&
          node.tagName.getText(source) === "LabInlineTerms" &&
          node.attributes.properties.some(
            (p) => ts.isJsxAttribute(p) && p.initializer?.getText(source) === `"${lab}"`,
          )
        )
          mounted = true;
        ts.forEachChild(node, visit);
      };
      visit(source);
      if (!mounted) missingIsland.push(lab);
      for (const id of quantities)
        if (!LABS_FACTS[lab]?.quantities[id]) missingFacts.push(`${lab} ${id}`);
    }
    // Reported, not asserted (18 of the 29 on 0abe0baa's concordance): it grows as the gaps close.
    console.log(`[labInlineTerms] ${coloured} labs with a coloured formula, each with its island`);
    expect(coloured).toBeGreaterThan(0);
    expect(missingIsland).toEqual([]);
    expect(missingFacts).toEqual([]);
  });

  test("no two quantities of one lab formula share a colour slot, unless the build names it", () => {
    // The build admits every inline view it can make distinct and names the rest
    // (build-equations.ts, sharedInlineViews), as it names a printed display it cannot: said,
    // never hidden. A lab formula may share a slot only when it is one of those.
    const named = (
      payload as unknown as { sharedInlineViews: Readonly<Record<string, readonly string[]>> }
    ).sharedInlineViews;
    const css = readFileSync("src/generated/quantity-colours-by-paper.css", "utf8");
    const slot = new Map<string, string>();
    for (const m of css.matchAll(
      /\[data-paper="([^"]+)"\] \[data-quantity-id="([^"]+)"\] \{ --qc: var\(--q-(\d+)\);/g,
    ))
      slot.set(`${m[1]} ${m[2]}`, m[3] as string);
    const shared: string[] = [];
    const said: string[] = [];
    let checked = 0;
    for (const site of SITES) {
      const result = labFormula(site.lab, site.latex, site.display, site.printed);
      if (result.kind !== "resolved") continue;
      const ids = [...new Set(result.compiled.terms.map((t) => t.quantityId))].sort();
      if (ids.length < 2) continue;
      checked++;
      const paper = result.compiled.paper;
      const slots = ids.map((id) => slot.get(`${paper} ${id}`));
      if (slots.some((s) => s === undefined) || new Set(slots).size !== ids.length) {
        const line = `${site.lab} ${site.latex}: ${ids.map((id, i) => `${id}=${slots[i]}`).join(" ")}`;
        if (named[paper]?.includes(`inline:${ids.join(" ")}`)) said.push(line);
        else shared.push(line);
      }
    }
    // Reported, not asserted: the palette's reach, which the build logs as well.
    console.log(
      `[labInlineTerms] ${checked} lab formulas of 2+ quantities, ${said.length} sharing by the build's word`,
    );
    for (const line of said) console.log(`[labInlineTerms]   ${line}`);
    expect(checked).toBeGreaterThan(0);
    expect(shared).toEqual([]);
  });

  describe("on lq-06's page", () => {
    let detach: () => void = () => {};
    beforeEach(async () => {
      await installDom();
      document.body.innerHTML = `<main>${await markup("lq-06")}</main>`;
    });
    afterEach(async () => {
      detach();
      await uninstallDom();
    });

    test("pointing at a glyph in a sentence lights every copy of its quantity on the page, and a press pins it", () => {
      const main = document.querySelector("main") as Element;
      const pins: (string | null)[] = [];
      detach = attachInlineLighting(main, "light-quanta", (p) => pins.push(p?.quantityId ?? null));
      const glyph = main.querySelector(
        '.inline-math[data-inline-terms][data-lab-formula="lq-06"] [data-quantity-id="frequency"]',
      ) as HTMLElement;
      expect(glyph).not.toBeNull();
      // The copies in the paper: other formulas, sentences and displays, so lighting them is
      // lighting the page. The lab's own values table names the quantity too, outside the paper,
      // and the island leaves it alone.
      const copies = [...main.querySelectorAll('[data-quantity-id="frequency"]')].filter(
        (e) => e.closest("[data-paper]")?.getAttribute("data-paper") === "light-quanta",
      );
      expect(copies.length).toBeGreaterThan(3);
      glyph.dispatchEvent(new Event("pointerover", { bubbles: true, cancelable: true }));
      expect(main.querySelectorAll("[data-lit]").length).toBe(copies.length);
      glyph.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
      expect(pins).toEqual(["frequency"]);
      expect(LABS_FACTS["lq-06"]?.quantities.frequency).toBeDefined();
    });
  });
});
