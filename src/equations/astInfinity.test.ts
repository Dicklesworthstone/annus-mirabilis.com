import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import { type Expression, parseExpression } from "./ast.ts";
import { expressionToSpokenText } from "./derivations/a11yText.ts";
import { checkDimensions } from "./dimensions.ts";
import { expressionLatex } from "./latex.ts";
import type { Quantity, QuantityRegistry } from "./quantities.ts";

/**
 * Infinity as an integral's limit: paper 2, section 4 integrates the jump density over every
 * possible jump, from minus to plus infinity (D = 1/(2 tau) int Delta^2 phi(Delta) dDelta), and
 * the Gaussian moment integral runs over the whole line. Infinity is admitted there and nowhere
 * else, and an unbounded limit carries no dimension, so the limit-dimension check that catches a
 * wrong bound still catches one.
 */
const length = ["1", "0", "0", "0", "0", "0"];
const perLength = ["-1", "0", "0", "0", "0", "0"];
const time = ["0", "0", "1", "0", "0", "0"];
const diffusivity = ["2", "0", "-1", "0", "0", "0"];
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
  [
    q("diffusionCoefficient", "D", diffusivity),
    q("stepInterval", "\\tau", time),
    q("stepDisplacement", "\\Delta", length),
    q("stepDensity", "\\varphi", perLength),
    q("observationInterval", "t", time),
  ].map((x) => [x.id, x]),
);
const ID = "eq-model-test-infinity";
let n = 0;
const sym = (quantityId: string, extra: Record<string, unknown> = {}) =>
  ({ kind: "symbol", termId: `${ID}.t.s${n++}`, quantityId, ...extra }) as Expression;
const op = (x: Record<string, unknown>) => ({ ...x, opId: `${ID}.op.o${n++}` }) as Expression;
const INF = { kind: "constant", name: "infinity" } as Expression;
const MINUS_INF = { kind: "negate", argument: INF } as Expression;
const parse = (e: Expression) => parseExpression(e, ID, R);
const dims = (e: Expression) => checkDimensions(parse(e), R).status;
const latexOf = (e: Expression) => expressionLatex(parse(e), R);

/** D = 1/(2 tau) * integral from lower to upper of Delta^2 phi(Delta) dDelta. */
const jumpIntegral = (lower: Expression, upper: Expression) =>
  op({
    kind: "relation",
    operator: "=",
    left: sym("diffusionCoefficient"),
    right: op({
      kind: "product",
      args: [
        op({
          kind: "quotient",
          numerator: { kind: "number", value: "1" },
          denominator: op({
            kind: "product",
            args: [{ kind: "number", value: "2" }, sym("stepInterval")],
          }),
        }),
        op({
          kind: "integral",
          expression: op({
            kind: "product",
            args: [
              op({ kind: "power", base: sym("stepDisplacement"), exponent: { num: 2, den: 1 } }),
              sym("stepDensity", { at: sym("stepDisplacement") }),
            ],
          }),
          variable: sym("stepDisplacement"),
          lower,
          upper,
        }),
      ],
    }),
  });

describe("infinity as an integral's limit", () => {
  test("minus to plus infinity: parses, balances its dimensions, and renders as TeX KaTeX accepts", () => {
    const e = jumpIntegral(MINUS_INF, INF);
    expect(dims(e)).toBe("consistent");
    const tex = latexOf(e);
    expect(tex).toContain("\\int_{-\\infty}^{\\infty}");
    expect(() => renderToString(tex, { throwOnError: true })).not.toThrow();
    const rel = parse(e) as Extract<Expression, { kind: "relation" }>;
    expect(expressionToSpokenText(rel.right)).toContain("from minus infinity to infinity");
  });

  test("planted: infinity outside a limit is refused", () => {
    const bare = op({
      kind: "relation",
      operator: "=",
      left: sym("diffusionCoefficient"),
      right: INF,
    });
    expect(() => parse(bare)).toThrow(/only as an integral's limit/);
    const inArithmetic = jumpIntegral(
      MINUS_INF,
      op({ kind: "product", args: [{ kind: "number", value: "2" }, INF] }),
    );
    expect(() => parse(inArithmetic)).toThrow(/only as an integral's limit/);
  });

  test("planted: a finite limit with the wrong dimension is still caught beside an infinite one", () => {
    expect(dims(jumpIntegral(MINUS_INF, sym("observationInterval")))).toBe("inconsistent");
  });

  test("planted: an unknown constant name is still refused", () => {
    const e = jumpIntegral(MINUS_INF, { kind: "constant", name: "aleph" } as unknown as Expression);
    expect(() => parse(e)).toThrow(/Unsupported mathematical constant/);
  });
});
