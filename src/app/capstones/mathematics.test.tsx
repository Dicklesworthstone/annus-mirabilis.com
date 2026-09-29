/**
 * Every capstone shows the mathematics its own record names, and shows it from the generated
 * rendering rather than from anything typed here (dispatch 426).
 *
 * Measured before this: all four capstones carried ZERO rendered mathematics while the section
 * pages of the same papers carry 84 to 464 KaTeX instances each. The equation section was headed
 * "The displays this argument turns on" and showed a title, a purpose, the spoken form and a link.
 *
 * These checks are properties, not a census. The number of equations a capstone names is free to
 * change; what must hold is that each one resolves to a rendering, that the page shows one display
 * per equation, and that no LaTeX is written in the capstone code, which is the rule this change
 * could most easily have broken ("Results read from the edition, never retyped").
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadCapstone } from "../../discovery/capstone/loadCapstone.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { renderedEquation } from "./renderedEquations.ts";

const PAPERS = ["mass-energy", "brownian-motion", "light-quanta", "special-relativity"] as const;

describe("capstone mathematics", () => {
  test("every equation a capstone names resolves to a generated rendering", () => {
    let checked = 0;
    for (const paper of PAPERS) {
      const { equations } = loadCapstone(paper);
      // Non-vacuity per paper: a capstone naming no equation would make the loop below prove
      // nothing while passing.
      expect(equations.length, paper).toBeGreaterThan(0);
      for (const equation of equations) {
        const math = renderedEquation(paper, equation.equationId);
        expect(math, `${paper}: ${equation.equationId}`).toBeDefined();
        expect(math?.html.length ?? 0, equation.equationId).toBeGreaterThan(0);
        // The rendering belongs to a compiled expression tree, which is what makes it not a typed
        // formula: the digest comes from the generator, not from this repository's page code.
        expect(math?.treeDigest.length ?? 0, equation.equationId).toBeGreaterThan(0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
    console.log(`[capstone mathematics] ${checked} equations across ${PAPERS.length} capstones`);
  });

  test("the resolver says no rather than guessing", () => {
    // A paper with no generated file, and a real paper with an id it does not hold. Without these
    // a resolver that returned something for every input would satisfy the loop above forever.
    expect(renderedEquation("not-a-paper", "eq-model-me-symmetric-sum")).toBeUndefined();
    expect(renderedEquation("mass-energy", "eq-model-not-a-real-equation")).toBeUndefined();
  });

  test("each page renders one display per equation, and announces it once", async () => {
    for (const paper of PAPERS) {
      const { equations } = loadCapstone(paper);
      const mod = (await import(`./${paper}/page.tsx`)) as { default: () => never };
      const html = await exportMarkup(mod.default());
      const displays = (html.match(/class="katex-display"/g) ?? []).length;
      expect(displays, paper).toBe(equations.length);
      /*
        THE WRAPPER IS NOT aria-hidden, and this assertion is the reason (dispatch 430).

        It used to be, and it used to be asserted here. Measured at 320px on a build containing
        a03a90c7, one of the 13 elements overflows, and initFormulaOverflow gives any region that
        really scrolls a tabindex="0" and an aria-label. An aria-hidden element with a tab stop is
        focusable and unannounced, so the pairing this once asserted was the defect.

        The formula is still read once: KaTeX puts aria-hidden on its own visual layer and this
        artifact carries no MathML, so the spoken paragraph is the only thing announced, which the
        next assertion checks.
      */
      const wrappers = (html.match(/class="capstone-math"/g) ?? []).length;
      expect(wrappers, paper).toBe(equations.length);
      expect(html, `${paper}: the wrapper must not be hidden and focusable`).not.toContain(
        'class="capstone-math" aria-hidden',
      );
      expect(
        (html.match(/<math[\s>]/g) ?? []).length,
        `${paper}: no MathML to double-announce`,
      ).toBe(0);
      // The markup escapes an apostrophe, and several spoken forms contain one ("the electron's
      // charge"), so the comparison is against decoded text. Matching the raw markup instead
      // reported a missing spoken form for a page that carries it.
      const decoded = html
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"');
      for (const equation of equations)
        expect(decoded, `${paper}: ${equation.equationId} spoken form`).toContain(equation.spoken);
    }
  });

  test("no LaTeX is written in the capstone pages", () => {
    // The rule this change could most easily have broken. A backslash command or a dollar-delimited
    // formula in this directory would mean a formula had been typed rather than read.
    const files = [
      "src/app/capstones/renderedEquations.ts",
      ...PAPERS.map((paper) => `src/app/capstones/${paper}/page.tsx`),
    ];
    let scanned = 0;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // Comments explain the change and may name a command, so only executable lines are read.
      const code = source
        .split("\n")
        .filter((line) => {
          const trimmed = line.trim();
          return !(
            trimmed.startsWith("*") ||
            trimmed.startsWith("//") ||
            trimmed.startsWith("/*") ||
            trimmed.startsWith("{/*")
          );
        })
        .join("\n");
      expect(code, file).not.toMatch(/\\frac|\\sqrt|\\approx|\\cdot|\\left|\\right/);
      // `${a}: ${b}` holds two dollars with text between them and is not a formula, so an
      // interpolation opening is excluded. Without this the check failed on its own file.
      expect(code, file).not.toMatch(/\$(?!\{)[^$\n]{3,}\$/);
      scanned += 1;
    }
    expect(scanned).toBe(files.length);
  });
});
