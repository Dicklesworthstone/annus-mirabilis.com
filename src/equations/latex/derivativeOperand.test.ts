import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { expressionLatex } from "../latex.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";

/**
 * A derivative of a lone letter is printed bare, as the papers print it: the Brownian paper's
 * \partial f / \partial t, never \partial (f) / \partial t. Every derivative on the site was
 * bracketed, so all eleven, in seven records, carried a bracket around one letter. A two-token
 * glyph and a compound operand keep their brackets, which is what makes \partial (x + y) mean the
 * derivative of the sum.
 */
const q = (id: string, glyph: string): Quantity => ({
  id,
  name: id,
  glyph,
  dimension: ["0", "0", "1", "0", "0", "0"],
  unit: "s",
  displayUnit: "s",
  displayPower: 0,
  semanticKind: "time",
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [
    q("density", "f"),
    q("position", "x"),
    q("time", "t"),
    q("increment", "\\Delta t"),
    q("sub", "k_B"),
  ].map((x) => [x.id, x]),
);
const sym = (quantityId: string, extra: Record<string, unknown> = {}): Expression =>
  ({ kind: "symbol", termId: `eq-model-test.t.${quantityId}`, quantityId, ...extra }) as Expression;
const d = (expression: Expression, order = 1): Expression =>
  ({
    kind: "derivative",
    expression,
    variable: sym("position"),
    order,
    partial: true,
  }) as Expression;
const latex = (tree: Expression, marked = false) => expressionLatex(tree, R, marked);
const accepted = (s: string) =>
  expect(() => renderToString(s, { throwOnError: true, strict: "error" })).not.toThrow();

describe("the operand of a derivative", () => {
  test("a lone letter is bare, first and second order, and KaTeX accepts both", () => {
    expect(latex(d(sym("density")))).toBe("\\frac{\\partial f}{\\partial x}");
    expect(latex(d(sym("density"), 2))).toBe("\\frac{\\partial^{2} f}{\\partial x^{2}}");
    expect(latex(d(sym("sub")))).toBe("\\frac{\\partial k_B}{\\partial x}");
    accepted(latex(d(sym("density"))));
    accepted(latex(d(sym("density"), 2)));
  });

  test("a value at arguments is bare too: its own brackets are the only ones", () => {
    const s = latex(d(sym("density", { args: [sym("position"), sym("time")] })));
    expect(s).toBe("\\frac{\\partial f\\left(x,\\,t\\right)}{\\partial x}");
    accepted(s);
  });

  test("coloured, the letter keeps its term and still takes no bracket", () => {
    const s = latex(d(sym("density")), true);
    expect(s).toContain("\\partial \\htmlData{term=eq-model-test.t.density}");
    expect(s).not.toContain("\\left(");
  });

  test("planted: a two-token glyph keeps its brackets", () => {
    expect(latex(d(sym("increment")))).toBe(
      "\\frac{\\partial\\left(\\Delta t\\right)}{\\partial x}",
    );
  });

  test("planted: a sum keeps its brackets", () => {
    const sum = { kind: "sum", args: [sym("density"), sym("sub")] } as Expression;
    const s = latex(d(sum));
    expect(s).toBe("\\frac{\\partial\\left(f + k_B\\right)}{\\partial x}");
    accepted(s);
  });

  test("planted: a scaled letter keeps its brackets", () => {
    const half = sym("density", { scale: { num: 1, den: 2 } });
    expect(latex(d(half))).toContain("\\partial\\left(");
  });
});
