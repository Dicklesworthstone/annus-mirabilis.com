/**
 * A formula read in a paper and sections with no lab's letters (ScopedFormula, dispatch 274, for the
 * explanation displays of 273): drawn in the faces' inline markup in a sentence and as a printed
 * display otherwise, naming its unbound glyphs when it cannot be read, and never taking a lab's own
 * reading of a letter.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { ScopedFormula } from "./ScopedFormula.tsx";

async function drawn(element: Parameters<typeof exportMarkup>[0]) {
  const { document } = new Window();
  document.body.innerHTML = await exportMarkup(element);
  const formula = document.querySelector("[data-scoped-formula]");
  expect(formula).not.toBeNull();
  return formula as NonNullable<typeof formula>;
}

describe("ScopedFormula", () => {
  test("in a sentence, the faces' inline markup, its terms marked in its paper", async () => {
    const formula = await drawn(
      <ScopedFormula paper="special-relativity" sections={["s4"]} latex="\beta" where="test" />,
    );
    expect(formula.tagName.toLowerCase()).toBe("span");
    expect(formula.className).toBe("inline-math");
    expect(formula.hasAttribute("data-inline-terms")).toBe(true);
    expect(formula.getAttribute("data-paper")).toBe("special-relativity");
    expect(formula.getAttribute("data-scoped-formula")).toBe("test");
    // The paper's β, the Lorentz factor: sr-05's reading of β as the speed ratio (labs.yaml)
    // does not reach it.
    expect(formula.querySelector("[data-quantity-id]")?.getAttribute("data-quantity-id")).toBe(
      "lorentzFactor",
    );
  });

  test("as a display, the printed displays' block", async () => {
    const formula = await drawn(
      <ScopedFormula
        paper="special-relativity"
        sections={["s4"]}
        latex="\beta"
        display
        where="d"
      />,
    );
    expect(formula.tagName.toLowerCase()).toBe("div");
    expect(formula.className).toBe("printed-display-terms");
    expect(formula.querySelector(".formula[data-latex]")).not.toBeNull();
  });

  test("a glyph the paper does not bind there is named, and the formula drawn plain", async () => {
    const formula = await drawn(
      <ScopedFormula paper="mass-energy" sections={["s0"]} latex="\Xi_{\text{plant}}" where="t" />,
    );
    expect(formula.getAttribute("data-inline-refused")).toContain("\\Xi");
    expect(formula.querySelector("[data-quantity-id]")).toBeNull();
    expect(formula.querySelector(".katex")).not.toBeNull();
  });

  test("with no section, it says it is unscoped rather than drawing plain in silence", async () => {
    const formula = await drawn(
      <ScopedFormula paper="mass-energy" sections={[]} latex="L" where="u" />,
    );
    expect(formula.getAttribute("data-scoped-formula-unscoped")).toBe("true");
  });
});
