import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { expressionLatex } from "../latex.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";

/**
 * The square of a mean is printed <x>^2, as the mean-variance lesson prints it in
 * Var(x) = <x^2> - <x>^2. The renderer bracketed every base that was not a lone letter, so it read
 * (<x>)^2; the angle brackets already delimit the mean. Other compound bases keep their brackets.
 */
const q = (id: string, glyph: string): Quantity => ({
  id,
  name: id,
  glyph,
  dimension: ["0", "0", "0", "0", "0", "0"],
  unit: "1",
  displayUnit: "1",
  displayPower: 0,
  semanticKind: id,
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [q("x", "x"), q("omega", "\\omega"), q("t", "t")].map((x) => [x.id, x]),
);
const sym = (id: string): Expression =>
  ({ kind: "symbol", termId: `eq-model-test.t.${id}`, quantityId: id }) as Expression;
const squared = (base: Expression): Expression =>
  ({
    kind: "power",
    opId: "eq-model-test.op.power",
    base,
    exponent: { num: 2, den: 1 },
  }) as Expression;
const mean = (argument: Expression): Expression =>
  ({ kind: "average", opId: "eq-model-test.op.mean", argument }) as Expression;
const latex = (tree: Expression, marked = false) => expressionLatex(tree, R, marked);
const accepted = (s: string) =>
  expect(() => renderToString(s, { throwOnError: true, strict: "error" })).not.toThrow();

describe("a power on a mean", () => {
  test("the square of a mean is <x>^2, with no extra brackets, and KaTeX accepts it", () => {
    const s = latex(squared(mean(sym("x"))));
    expect(s).toBe("\\left\\langle x\\right\\rangle^{2}");
    accepted(s);
  });

  test("the mean of a square is unchanged: <x^2>", () => {
    expect(latex(mean(squared(sym("x"))))).toBe("\\left\\langle x^{2}\\right\\rangle");
  });

  test("coloured, the mean keeps its marker inside the power's", () => {
    const s = latex(squared(mean(sym("x"))), true);
    expect(s).toContain("\\htmlData{op=eq-model-test.op.power}");
    expect(s).toContain("\\htmlData{op=eq-model-test.op.mean}");
    expect(s).not.toContain("\\left(");
  });

  test("planted: a function and a sum keep their brackets", () => {
    const cos = {
      kind: "function",
      name: "cos",
      argument: { kind: "product", args: [sym("omega"), sym("t")] },
    } as Expression;
    expect(latex(squared(cos))).toBe("\\left(\\cos\\left(\\omega\\,t\\right)\\right)^{2}");
    const sum = { kind: "sum", args: [sym("x"), sym("t")] } as Expression;
    expect(latex(squared(sum))).toBe("\\left(x + t\\right)^{2}");
  });
});
