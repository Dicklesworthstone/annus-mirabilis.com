/**
 * The notation toggle from record to page (am-read-perspective-toggle-abd):
 * compileEquationWithNotation draws a relativity record a second time in Einstein's letters, or
 * marks that it keeps today's, and the two views carry both forms for html[data-notation] to
 * choose between. A reading row is one formula: it never shows his letters in one relation beside
 * ours in the next.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import { ColouredFormula } from "../reader/ColouredFormula.tsx";
import type { EquationRecord } from "./record.ts";
import { compileEquation, compileEquationWithNotation } from "./render.ts";
import { SemanticEquation } from "./SemanticEquation.tsx";
import { withQuantityIds } from "./termQuantities.ts";

const { entries } = loadConcordanceForPaper("special-relativity");
const record = (id: string): EquationRecord =>
  JSON.parse(
    readFileSync(join(process.cwd(), "content/equations/special-relativity", `${id}.json`), "utf8"),
  );
const slowClock = compileEquationWithNotation(record("eq-model-sr-slow-clock"), {
  entries,
  section: "s4",
});
const PDF = "/papers/pdfs/ap-17-891.pdf";
const dopplerFactor = compileEquationWithNotation(record("eq-model-sr-doppler-factor"), {
  entries,
  section: "s7",
  seeAt: { face: "facsimile", href: PDF },
});

describe("compileEquationWithNotation", () => {
  test("a record whose symbols all resolve is drawn again in Einstein's letters", () => {
    const form = slowClock.notationForm;
    expect(form?.state).toBe("printed");
    if (form?.state !== "printed") return;
    expect(form.plainLatex).toBe(
      "1 - \\frac{1}{\\beta} \\approx \\frac{1}{2}\\,\\frac{v^{2}}{V^{2}}",
    );
    // Today's form is untouched beside it.
    expect(slowClock.plainLatex).toContain("\\gamma");
    expect(form.mathml).toContain("<mi>V</mi>");
    expect(form.mathml).not.toContain("<mi>c</mi>");
    // The sentence names his letters where it named ours, and leaves every other word alone.
    expect(form.sentence.map((f) => f.text)).toEqual(
      slowClock.sentence.map((f) => (f.text === "gamma" ? "beta" : f.text === "c" ? "V" : f.text)),
    );
    // Every term and operation of the tree is still addressable in his letters.
    for (const n of slowClock.navigation)
      expect(form.html).toContain(`data-${n.kind === "term" ? "term" : "op"}="${n.id}"`);
    expect(Object.keys(form.glyphHtml).sort()).toEqual(["lorentzFactor", "speedOfLight"]);
  });

  test("a record held by one symbol is marked, and carries no second drawing", () => {
    expect(dopplerFactor.notationForm).toEqual({
      state: "modern",
      seeAt: { face: "facsimile", href: PDF },
    });
  });

  test("without a context nothing is added: the other papers' payloads are unchanged", () => {
    expect(compileEquation(record("eq-model-sr-slow-clock")).notationForm).toBeUndefined();
  });
});

describe("the views carry both forms", () => {
  test("the explorer card: both drawings, both sentences, the eyebrow says which", () => {
    const html = renderToStaticMarkup(<SemanticEquation equation={slowClock} />);
    const printed = slowClock.notationForm;
    if (printed?.state !== "printed") throw new Error("slow-clock has no printed form");
    // The drawing in his letters is the one compiled for it, beside today's; each term span
    // carries its exact quantity id as well (termQuantities.ts, dispatch 144), and nothing else
    // in the compiled drawing changes.
    expect(html).toContain(withQuantityIds(printed.html, slowClock.terms));
    expect(html).toContain(printed.mathml);
    expect(html).toContain(withQuantityIds(slowClock.html, slowClock.terms));
    expect(html.match(/data-notation-form="printed"/g)?.length).toBe(4);
    expect(html.match(/data-notation-form="modern"/g)?.length).toBe(4);
    expect(html).toContain("Einstein&#x27;s letters");
    expect(html).not.toContain("data-notation-note");
  });

  test("a held card says so in one line and switches nothing", () => {
    const html = renderToStaticMarkup(<SemanticEquation equation={dopplerFactor} />);
    expect(html).toContain("Shown in modern letters; Einstein&#x27;s are in the");
    expect(html).toContain(`href="${PDF}"`);
    expect(html).not.toContain("German source face");
    expect(html).not.toContain("data-notation-form");
  });

  test("a reading row with one held relation stays in today's letters throughout", () => {
    const mixed = renderToStaticMarkup(<ColouredFormula equations={[slowClock, dopplerFactor]} />);
    expect(mixed).not.toContain("data-notation-form");
    expect(mixed).toContain("data-notation-note");
    const whole = renderToStaticMarkup(<ColouredFormula equations={[slowClock]} />);
    if (slowClock.notationForm?.state === "printed")
      expect(whole).toContain(withQuantityIds(slowClock.notationForm.html, slowClock.terms));
    // Visual and MathML for the relation, and the two renamed quantities' legend glyphs.
    expect(whole.match(/data-notation-form="printed"/g)?.length).toBe(4);
    expect(whole).not.toContain("data-notation-note");
  });
});
