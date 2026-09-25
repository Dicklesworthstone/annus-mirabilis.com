/**
 * β in a card's as-printed layer is refused only where the paper does not print β (dispatch 240).
 * The rule was written for mass-energy, whose concordance says the Lorentz factor is written out as
 * a radical and β does not appear; light quanta prints Wien's β in R β ν / N throughout, so the same
 * rule refused Einstein's own text.
 */
import { describe, expect, test } from "bun:test";
import { printedFormProblems, resultContext } from "./resultCards.ts";

const ROOT = process.cwd();

describe("β in a printed excerpt", () => {
  test("refused by default and where the paper does not print it; allowed where it does", () => {
    const quantum = "\\frac{R}{N} \\beta \\nu - P .";
    expect(printedFormProblems(quantum)).toEqual(["carries β, which the paper does not print"]);
    expect(printedFormProblems(quantum, { printsBeta: false })).toHaveLength(1);
    expect(printedFormProblems(quantum, { printsBeta: true })).toEqual([]);
    // The ellipsis rule is untouched by the flag.
    expect(printedFormProblems("A_1 A_2 \\ldots", { printsBeta: true })).toHaveLength(1);
  });

  test("the flag is read from each paper's concordance", () => {
    // Mass-energy writes the radical out; light quanta prints Wien's constant as β.
    expect(resultContext(ROOT, "mass-energy")?.printsBeta).toBe(false);
    expect(resultContext(ROOT, "light-quanta")?.printsBeta).toBe(true);
  });
});
