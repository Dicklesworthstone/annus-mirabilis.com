import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import { type Expression, parseExpression } from "./ast.ts";
import { expressionToSpokenText } from "./derivations/a11yText.ts";
import { containsId, structurallyEqual, substituteNode } from "./derivations/treeUtils.ts";
import { checkDimensions } from "./dimensions.ts";
import { expressionLatex } from "./latex.ts";
import type { Quantity, QuantityRegistry } from "./quantities.ts";

/**
 * A limit: paper 4's low-speed step, lim_{v -> 0} 2L(gamma - 1)/v^2 = L/c^2 (TanElk's ruling,
 * 2026-09-23: a `limit` node with the variable, the value it approaches as a quantity of the
 * variable's dimension, and the body). The value approached is a value of the variable, so the
 * integral-limit rule applies: it carries the variable's dimension and kind, except 0 and plus or
 * minus infinity. The limit has the dimension of its body.
 */
const speed = ["1", "0", "-1", "0", "0", "0"];
const energy = ["2", "1", "-2", "0", "0", "0"];
const time = ["0", "0", "1", "0", "0", "0"];
const one = ["0", "0", "0", "0", "0", "0"];
const q = (id: string, glyph: string, dimension: string[], kind = id): Quantity => ({
  id,
  name: id,
  glyph,
  dimension,
  unit: "1",
  displayUnit: "1",
  displayPower: 0,
  semanticKind: kind,
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [
    q("bodySpeed", "v", speed, "speed"),
    q("otherSpeed", "u", speed, "speed"),
    q("speedOfLight", "c", speed),
    q("emittedEnergy", "L", energy),
    q("lorentzFactor", "\\gamma", one),
    q("elapsedTime", "t", time),
  ].map((x) => [x.id, x]),
);
const ID = "eq-model-test-limit";
let n = 0;
const sym = (quantityId: string) =>
  ({ kind: "symbol", termId: `${ID}.t.s${n++}`, quantityId }) as Expression;
const op = (x: Record<string, unknown>) => ({ ...x, opId: `${ID}.op.o${n++}` }) as Expression;
const num = (value: string) => ({ kind: "number", value }) as Expression;
const INF = { kind: "constant", name: "infinity" } as Expression;
const parse = (e: Expression) => parseExpression(e, ID, R);
const dims = (e: Expression) => checkDimensions(parse(e), R).status;
const latexOf = (e: Expression) => expressionLatex(parse(e), R);

/** 2L(gamma - 1)/v^2: an energy over a squared speed, a mass. */
const body = () =>
  op({
    kind: "quotient",
    numerator: op({
      kind: "product",
      args: [
        num("2"),
        sym("emittedEnergy"),
        op({
          kind: "group",
          argument: op({
            kind: "sum",
            args: [sym("lorentzFactor"), { kind: "negate", argument: num("1") }],
          }),
        }),
      ],
    }),
    denominator: op({ kind: "power", base: sym("bodySpeed"), exponent: { num: 2, den: 1 } }),
  });
const limit = (approaches: Expression, expression: Expression = body(), variable = "bodySpeed") =>
  op({ kind: "limit", variable: sym(variable), approaches, expression });
/** lim_{v -> approaches} body = right. */
const relation = (approaches: Expression, right?: Expression) =>
  op({
    kind: "relation",
    operator: "=",
    left: limit(approaches),
    right:
      right ??
      op({
        kind: "quotient",
        numerator: sym("emittedEnergy"),
        denominator: op({
          kind: "power",
          base: sym("speedOfLight"),
          exponent: { num: 2, den: 1 },
        }),
      }),
  });

describe("a limit node", () => {
  test("paper 4's low-speed limit parses, balances, renders as TeX KaTeX accepts, and is spoken", () => {
    const e = relation(num("0"));
    expect(dims(e)).toBe("consistent");
    const tex = latexOf(e);
    expect(tex).toContain("\\lim_{v \\to 0}");
    expect(() => renderToString(tex, { throwOnError: true })).not.toThrow();
    const rel = parse(e) as Extract<Expression, { kind: "relation" }>;
    // The derivations' spoken text names a symbol by its term id; the phrasing is what is tested.
    expect(expressionToSpokenText(rel.left)).toMatch(
      /^the limit, as \S+ approaches 0, of 2 times /,
    );
  });

  test("the value approached may be infinity, or a quantity of the variable's dimension and kind", () => {
    const toInfinity = relation(INF);
    expect(dims(toInfinity)).toBe("consistent");
    expect(latexOf(toInfinity)).toContain("\\to \\infty");
    expect(dims(relation(sym("otherSpeed")))).toBe("consistent");
  });

  test("a limit of a sum is bracketed; a limit of a quotient is not", () => {
    const ofSum = limit(
      num("0"),
      op({ kind: "sum", args: [sym("emittedEnergy"), sym("emittedEnergy")] }),
    );
    expect(latexOf(ofSum)).toMatch(/\\to 0\} \\left\(/);
    expect(latexOf(limit(num("0")))).toMatch(/\\to 0\} \\frac/);
  });

  test("planted: a value approached of the wrong dimension is inconsistent", () => {
    expect(dims(relation(sym("elapsedTime")))).toBe("inconsistent");
  });

  test("planted: a bare nonzero number approached is not a speed", () => {
    expect(dims(relation(num("1")))).toBe("inconsistent");
  });

  test("planted: a value approached of the right dimension but another kind is refused", () => {
    expect(dims(relation(sym("speedOfLight")))).toBe("semantic-mismatch");
  });

  test("planted: the limit has its body's dimension, so a mass cannot equal an energy", () => {
    expect(dims(relation(num("0"), sym("emittedEnergy")))).toBe("inconsistent");
  });

  test("planted: the value approached cannot contain the variable", () => {
    const e = relation(op({ kind: "product", args: [num("2"), sym("bodySpeed")] }));
    expect(() => parse(e)).toThrow(/cannot contain the variable/);
  });

  test("planted: the variable must be a bound symbol", () => {
    const e = op({ kind: "limit", variable: num("3"), approaches: num("0"), expression: body() });
    expect(() => parse(e)).toThrow(/The variable must be a bound symbol/);
  });

  test("planted: infinity in the body, rather than as the value approached, is refused", () => {
    expect(() => parse(limit(num("0"), INF))).toThrow(/Infinity is admitted only/);
  });

  test("planted: a limit missing the value it approaches is refused", () => {
    const e = op({ kind: "limit", variable: sym("bodySpeed"), expression: body() });
    expect(() => parse(e)).toThrow();
  });

  test("the tree helpers see all three parts", () => {
    const a = parse(relation(num("0")));
    const lim = (a as Extract<Expression, { kind: "relation" }>).left as Extract<
      Expression,
      { kind: "limit" }
    >;
    expect(structurallyEqual(a, a)).toBe(true);
    expect(structurallyEqual(lim, { ...lim, approaches: INF })).toBe(false);
    const target = lim.variable as Extract<Expression, { kind: "symbol" }>;
    expect(containsId(a, target.termId)).toBe(true);
    const bodyId = (lim.expression as { opId: string }).opId;
    const replaced = substituteNode(a, bodyId, num("7")) as Extract<
      Expression,
      { kind: "relation" }
    >;
    expect((replaced.left as Extract<Expression, { kind: "limit" }>).expression).toEqual(num("7"));
  });
});
