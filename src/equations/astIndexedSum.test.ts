import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import { type Expression, parseExpression } from "./ast.ts";
import { expressionToSpokenText } from "./derivations/a11yText.ts";
import { containsId, structurallyEqual, substituteNode } from "./derivations/treeUtils.ts";
import { checkDimensions } from "./dimensions.ts";
import { expressionLatex } from "./latex.ts";
import type { Quantity, QuantityRegistry } from "./quantities.ts";

/**
 * An indexed sum: the mean of M values, <x> = (1/M) sum_{i=1}^{M} x_i, in the mean-variance
 * lesson, and the sum of n steps in paper 2, section 4. The index is one letter that the body's
 * symbols carry as their `index`. The bounds are counts, so they are dimensionless, and the sum
 * has the body's dimension.
 */
const length = ["1", "0", "0", "0", "0", "0"];
const one = ["0", "0", "0", "0", "0", "0"];
const q = (id: string, glyph: string, dimension: string[]): Quantity => ({
  id,
  name: id,
  glyph,
  dimension,
  unit: "1",
  displayUnit: "1",
  displayPower: 0,
  semanticKind: id,
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [q("displacement", "x", length), q("sampleCount", "M", one)].map((x) => [x.id, x]),
);
const ID = "eq-model-test-sum";
let n = 0;
const sym = (quantityId: string, extra: Record<string, unknown> = {}) =>
  ({ kind: "symbol", termId: `${ID}.t.s${n++}`, quantityId, ...extra }) as Expression;
const op = (x: Record<string, unknown>) => ({ ...x, opId: `${ID}.op.o${n++}` }) as Expression;
const num = (value: string) => ({ kind: "number", value }) as Expression;
const parse = (e: Expression) => parseExpression(e, ID, R);
const dims = (e: Expression) => checkDimensions(parse(e), R).status;
const latexOf = (e: Expression) => expressionLatex(parse(e), R);

const sum = (body: Expression, extra: Record<string, unknown> = {}) =>
  op({
    kind: "indexedSum",
    index: "i",
    from: num("1"),
    to: sym("sampleCount"),
    expression: body,
    ...extra,
  });
/** <x> = (1/M) times the sum of `body`. */
const mean = (
  body: Expression,
  left: Expression = op({ kind: "average", argument: sym("displacement") }),
) =>
  op({
    kind: "relation",
    operator: "=",
    left,
    right: op({
      kind: "product",
      args: [
        op({ kind: "quotient", numerator: num("1"), denominator: sym("sampleCount") }),
        sum(body),
      ],
    }),
  });

describe("an indexed sum", () => {
  test("the mean of M values parses, balances, renders as TeX KaTeX accepts, and is spoken", () => {
    const e = mean(sym("displacement", { index: "i" }));
    expect(dims(e)).toBe("consistent");
    const tex = latexOf(e);
    expect(tex).toContain("\\sum_{i=1}^{M} x_{i}");
    expect(() => renderToString(tex, { throwOnError: true })).not.toThrow();
    const rel = parse(e) as Extract<Expression, { kind: "relation" }>;
    const right = rel.right as unknown as { args: readonly Expression[] };
    expect(expressionToSpokenText(right.args[1] as Expression)).toMatch(
      /^the sum, for i from 1 to \S+, of /,
    );
  });

  test("the mean square balances too, and a sum body is bracketed", () => {
    const square = op({
      kind: "power",
      base: sym("displacement", { index: "i" }),
      exponent: { num: 2, den: 1 },
    });
    const meanSquare = op({
      kind: "average",
      argument: op({ kind: "power", base: sym("displacement"), exponent: { num: 2, den: 1 } }),
    });
    expect(dims(mean(square, meanSquare))).toBe("consistent");
    const body = op({
      kind: "sum",
      args: [sym("displacement", { index: "i" }), sym("displacement")],
    });
    expect(latexOf(sum(body))).toMatch(/\^\{M\} \\left\(/);
  });

  test("planted: a bound with a dimension is inconsistent", () => {
    const e = sum(sym("displacement", { index: "i" }), { to: sym("displacement") });
    expect(dims(e)).toBe("inconsistent");
  });

  test("planted: the sum has its body's dimension, so a length cannot equal a sum of areas", () => {
    const square = op({
      kind: "power",
      base: sym("displacement", { index: "i" }),
      exponent: { num: 2, den: 1 },
    });
    expect(dims(mean(square))).toBe("inconsistent");
  });

  test("planted: a body that does not use the index is refused", () => {
    expect(() => parse(sum(sym("displacement")))).toThrow(/must use its index/);
  });

  test("planted: an index that is not one lower-case letter is refused", () => {
    for (const index of ["ij", "I", "1"])
      expect(() => parse(sum(sym("displacement", { index: "i" }), { index }))).toThrow(
        /one lower-case letter/,
      );
  });

  test("the tree helpers see the body and both bounds", () => {
    const a = parse(mean(sym("displacement", { index: "i" })));
    const right = (a as Extract<Expression, { kind: "relation" }>).right as unknown as {
      args: readonly Expression[];
    };
    const s = right.args[1] as Extract<Expression, { kind: "indexedSum" }>;
    expect(structurallyEqual(a, a)).toBe(true);
    expect(structurallyEqual(s, { ...s, index: "j" })).toBe(false);
    expect(containsId(a, (s.to as { termId: string }).termId)).toBe(true);
    const bodyId = (s.expression as { termId: string }).termId;
    const replaced = substituteNode(a, bodyId, num("7")) as Extract<
      Expression,
      { kind: "relation" }
    >;
    const replacedSum = (replaced.right as unknown as { args: readonly Expression[] })
      .args[1] as Extract<Expression, { kind: "indexedSum" }>;
    expect(replacedSum.expression).toEqual(num("7"));
  });
});
