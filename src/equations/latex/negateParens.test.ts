import { describe, expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import { BROWNIAN_QUANTITIES } from "../quantities.ts";
import { renderLatex } from "./render.ts";

/*
  A minus sign wraps only what it must. It wrapped everything, so Wien's exponent printed
  exp(-(B nu / T)) and Delta m printed -(L / c^2). Pinned in both directions: a fix that dropped
  every parenthesis would print -a + b for -(a + b), a different number.
*/
const D: Expression = { kind: "symbol", termId: "x.t.d", quantityId: "diffusionCoefficient" };
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
const render = (tree: Expression) =>
  renderLatex(tree, { registry: BROWNIAN_QUANTITIES, strictConcordance: false });

describe("negation takes parentheses only where dropping them would change the value", () => {
  test("a fraction, a symbol, a product and a function need none", () => {
    expect(render(neg({ kind: "quotient", numerator: D, denominator: D }))).toBe("-\\frac{D}{D}");
    expect(render(neg(D))).toBe("-D");
    expect(render(neg({ kind: "product", args: [D, D] }))).toBe("-D\\,D");
    expect(render(neg({ kind: "function", name: "ln", argument: D }))).toBe(
      "-\\ln\\left(D\\right)",
    );
  });

  test("a sum, a second negation and a negative literal keep them", () => {
    expect(render(neg({ kind: "sum", args: [D, D] }))).toBe("-\\left(D + D\\right)");
    expect(render(neg(neg(D)))).toBe("-\\left(-D\\right)");
    expect(render(neg({ kind: "number", value: "-3" }))).toBe("-\\left(-3\\right)");
  });
});
