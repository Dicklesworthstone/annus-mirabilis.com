import { describe, expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import { BROWNIAN_QUANTITIES, type Quantity, type QuantityRegistry } from "../quantities.ts";
import { renderLatex } from "./render.ts";

/*
  The paper prints V^2, and the renderer printed (V)^2: every power wrapped its base. These pin the
  rule in both directions, because a fix that dropped ALL parentheses would pass the first case
  and print -x^2 for (-x)^2, a different number.
*/
const D: Expression = { kind: "symbol", termId: "x.t.d", quantityId: "diffusionCoefficient" };
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const render = (tree: Expression, registry: QuantityRegistry = BROWNIAN_QUANTITIES) =>
  renderLatex(tree, { registry, strictConcordance: false });

describe("an atomic base takes no parentheses; anything else keeps them", () => {
  test("a lone symbol, a plain number and pi are atoms", () => {
    expect(render(square(D))).toBe("D^{2}");
    expect(render(square({ kind: "number", value: "3" }))).toBe("3^{2}");
    expect(render(square({ kind: "constant", name: "pi" }))).toBe("\\pi^{2}");
  });

  test("a negative number, a sum and a scaled symbol keep their parentheses", () => {
    expect(render(square({ kind: "number", value: "-3" }))).toBe("\\left(-3\\right)^{2}");
    expect(render(square({ kind: "sum", args: [D, D] }))).toBe("\\left(D + D\\right)^{2}");
    expect(render(square({ ...D, scale: { num: 1, den: 2 } } as Expression))).toMatch(
      /^\\left\(.*\\right\)\^\{2\}$/,
    );
  });

  test("a glyph that already carries a superscript is not an atom", () => {
    const starred = {
      ...BROWNIAN_QUANTITIES.diffusionCoefficient,
      id: "starred",
      glyph: "D^{*}",
    } as Quantity;
    const tree = square({ kind: "symbol", termId: "x.t.s", quantityId: "starred" });
    expect(render(tree, { ...BROWNIAN_QUANTITIES, starred })).toBe("\\left(D^{*}\\right)^{2}");
  });

  test("a negative literal after the first term is a subtraction", () => {
    expect(render({ kind: "sum", args: [D, { kind: "number", value: "-1" }] })).toBe("D - 1");
    expect(render({ kind: "sum", args: [{ kind: "number", value: "-1" }, D] })).toBe("-1 + D");
  });
});
