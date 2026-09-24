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

  test("planted: exp, ln and a sum keep their brackets", () => {
    // ln^2 x would read as either (ln x)^2 or ln(x^2); only sin and cos take the power on the name.
    for (const name of ["exp", "ln"]) {
      const f = { kind: "function", name, argument: sym("x") } as Expression;
      expect(latex(squared(f))).toBe(`\\left(\\${name}\\left(x\\right)\\right)^{2}`);
    }
    const sum = { kind: "sum", args: [sym("x"), sym("t")] } as Expression;
    expect(latex(squared(sum))).toBe("\\left(x + t\\right)^{2}");
  });
});

describe("a power on sin or cos", () => {
  const trig = (name: "sin" | "cos", opId?: string) =>
    ({
      kind: "function",
      name,
      ...(opId ? { opId } : {}),
      argument: { kind: "product", args: [sym("omega"), sym("t")] },
    }) as Expression;

  test("cos squared is cos^2(omega t), as print sets it, and KaTeX accepts it", () => {
    for (const name of ["sin", "cos"] as const) {
      const s = latex(squared(trig(name)));
      expect(s).toBe(`\\${name}^{2}\\left(\\omega\\,t\\right)`);
      accepted(s);
    }
  });

  test("coloured, the function's marker wraps the whole of it, the power included", () => {
    const s = latex(squared(trig("cos", "eq-model-test.op.cos")), true);
    expect(s).toContain("\\htmlData{op=eq-model-test.op.cos}{\\cos^{2}\\left(");
    expect(s).toContain("\\htmlData{op=eq-model-test.op.power}");
    expect(s).not.toContain("\\right)\\right)^{2}");
  });
});
