import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import { type Expression, parseExpression, quantityBindings } from "./ast.ts";
import { expressionToSpokenText } from "./derivations/a11yText.ts";
import { structurallyEqual } from "./derivations/treeUtils.ts";
import { checkDimensions } from "./dimensions.ts";
import { expressionLatex } from "./latex.ts";
import type { Quantity, QuantityRegistry } from "./quantities.ts";

/**
 * The four constructs relativity needs, each with a case that must work and a planted wrong one
 * that must fail for its own reason: a component or instance index on a symbol (E_y, t_0), a
 * quantity's value at an argument (gamma(u), u(t)), a partial-derivative operator standing alone
 * (section 6's operator identity), and an integral with limits (sections 4 and 10).
 *
 * Then the two the light-quanta paper needs, on the same terms: a power whose exponent is a
 * quantity (W = f^n, section 5) and a partial derivative with a quantity held fixed
 * ((ds/drho)_nu = 1/T, section 3).
 */
const length = ["1", "0", "0", "0", "0", "0"];
const time = ["0", "0", "1", "0", "0", "0"];
const speed = ["1", "0", "-1", "0", "0", "0"];
const ratio = ["0", "0", "0", "0", "0", "0"];
const eField = ["1", "1", "-3", "0", "-1", "0"];
const bField = ["0", "1", "-2", "0", "-1", "0"];
const energy = ["2", "1", "-2", "0", "0", "0"];
const mass = ["0", "1", "0", "0", "0", "0"];
const volume = ["3", "0", "0", "0", "0", "0"];
const frequency = ["0", "0", "-1", "0", "0", "0"];
const temperature = ["0", "0", "0", "1", "0", "0"];
const spectralEnergy = ["-1", "1", "-1", "0", "0", "0"];
const spectralEntropy = ["-1", "1", "-1", "-1", "0", "0"];
const q = (id: string, glyph: string, dimension: string[], semanticKind = id): Quantity => ({
  id,
  name: id,
  glyph,
  dimension,
  unit: "1",
  displayUnit: "1",
  displayPower: 0,
  semanticKind,
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [
    q("electricFieldStationary", "E", eField),
    q("electricFieldMoving", "E'", eField),
    q("magneticFieldStationary", "B", bField),
    q("lorentzFactor", "\\gamma", ratio),
    q("frameSpeed", "v", speed, "velocity"),
    q("particleSpeed", "u", speed, "velocity"),
    q("speedOfLight", "c", speed),
    q("coordinateTimeStationary", "t", time),
    q("coordinatePositionStationary", "x", length),
    q("coordinatePositionMoving", "x'", length),
    q("coordinateTimeMoving", "t'", time),
    q("properTimeElapsed", "\\Delta\\tau", time),
    q("kineticEnergy", "K", energy),
    q("electronMass", "m", mass),
    q("configurationProbability", "W", ratio),
    q("volumeRatio", "f", ratio),
    q("quantumCount", "n", ratio),
    q("volume", "V", volume),
    q("spectralEntropyDensity", "s", spectralEntropy),
    q("spectralEnergyDensity", "\\rho", spectralEnergy),
    q("frequency", "\\nu", frequency),
    q("temperature", "T", temperature),
  ].map((x) => [x.id, x]),
);

const ID = "eq-model-test-ext";
let n = 0;
const sym = (quantityId: string, extra: Record<string, unknown> = {}) =>
  ({ kind: "symbol", termId: `${ID}.t.s${n++}`, quantityId, ...extra }) as Expression;
const op = (x: Record<string, unknown>) => ({ ...x, opId: `${ID}.op.o${n++}` }) as Expression;
const rel = (left: Expression, right: Expression) =>
  op({ kind: "relation", operator: "=", left, right });
const sq = (x: Expression) => op({ kind: "power", base: x, exponent: { num: 2, den: 1 } });
const neg = (x: Expression) => ({ kind: "negate", argument: x }) as Expression;

function parse(tree: Expression) {
  return parseExpression(tree, ID, R);
}
function latexOf(tree: Expression) {
  const latex = expressionLatex(parse(tree), R);
  // What the page shows must be valid KaTeX, not only plausible text.
  renderToString(latex, { throwOnError: true, strict: "error" });
  return latex;
}
function dims(tree: Expression) {
  return checkDimensions(parse(tree), R).status;
}

describe("a component or instance index on a symbol", () => {
  // E'_y = gamma (E_y - v B_z): paper 3 section 6, one field component.
  const field = () =>
    rel(
      sym("electricFieldMoving", { index: "y" }),
      op({
        kind: "product",
        args: [
          sym("lorentzFactor"),
          op({
            kind: "sum",
            args: [
              sym("electricFieldStationary", { index: "y" }),
              neg(
                op({
                  kind: "product",
                  args: [sym("frameSpeed"), sym("magneticFieldStationary", { index: "z" })],
                }),
              ),
            ],
          }),
        ],
      }),
    );

  test("prints as a subscript, keeps the quantity (so the colour), and checks", () => {
    const latex = latexOf(field());
    expect(latex).toContain("E'_{y}");
    expect(latex).toContain("E_{y}");
    expect(latex).toContain("B_{z}");
    expect(quantityBindings(parse(field())).map((b) => b.quantityId)).toContain(
      "electricFieldStationary",
    );
    expect(dims(field())).toBe("consistent");
    expect(expressionToSpokenText(parse(sym("electricFieldMoving", { index: "y" })))).toContain(
      "sub y",
    );
  });

  test("planted: TeX in an index is refused", () => {
    expect(() => parse(sym("electricFieldMoving", { index: "y^{2}" }))).toThrow(
      /component or instance label/,
    );
  });
});

describe("a quantity's value at an argument", () => {
  // gamma(u) = 1 / sqrt(1 - u^2 / c^2)
  const gammaOfU = () =>
    rel(
      sym("lorentzFactor", { at: sym("particleSpeed") }),
      op({
        kind: "quotient",
        numerator: { kind: "number", value: "1" },
        denominator: op({
          kind: "root",
          degree: 2,
          radicand: op({
            kind: "sum",
            args: [
              { kind: "number", value: "1" },
              neg(
                op({
                  kind: "quotient",
                  numerator: sq(sym("particleSpeed")),
                  denominator: sq(sym("speedOfLight")),
                }),
              ),
            ],
          }),
        }),
      }),
    );

  test("prints gamma(u), binds both quantities, and checks", () => {
    expect(latexOf(gammaOfU())).toContain("\\gamma\\left(u\\right)");
    const ids = quantityBindings(parse(gammaOfU())).map((b) => b.quantityId);
    expect(ids).toContain("lorentzFactor");
    expect(ids).toContain("particleSpeed");
    expect(dims(gammaOfU())).toBe("consistent");
    expect(
      expressionToSpokenText(parse(sym("lorentzFactor", { at: sym("particleSpeed") }))),
    ).toMatch(/ of /);
  });

  test("planted: an argument that adds a speed to a time is still caught", () => {
    const bad = rel(
      sym("lorentzFactor", {
        at: op({ kind: "sum", args: [sym("particleSpeed"), sym("coordinateTimeStationary")] }),
      }),
      { kind: "number", value: "1" },
    );
    expect(dims(bad)).toBe("inconsistent");
  });
});

describe("a partial-derivative operator standing alone", () => {
  const partial = (quantityId: string) =>
    op({ kind: "partialOperator", variable: sym(quantityId) });
  // d/dx = gamma (d/dx' - (v / c^2) d/dt'): section 6's operator identity.
  const identity = (divideByC2: boolean) =>
    rel(
      partial("coordinatePositionStationary"),
      op({
        kind: "product",
        args: [
          sym("lorentzFactor"),
          op({
            kind: "sum",
            args: [
              partial("coordinatePositionMoving"),
              neg(
                divideByC2
                  ? op({
                      kind: "quotient",
                      numerator: op({
                        kind: "product",
                        args: [sym("frameSpeed"), partial("coordinateTimeMoving")],
                      }),
                      denominator: sq(sym("speedOfLight")),
                    })
                  : op({
                      kind: "product",
                      args: [sym("frameSpeed"), partial("coordinateTimeMoving")],
                    }),
              ),
            ],
          }),
        ],
      }),
    );

  test("prints the operator, and the identity balances per metre", () => {
    const latex = latexOf(identity(true));
    expect(latex).toContain("\\partial_{x}");
    expect(latex).toContain("\\partial_{t'}");
    expect(dims(identity(true))).toBe("consistent");
    const operator = parse(partial("coordinatePositionStationary")) as Extract<
      Expression,
      { kind: "partialOperator" }
    >;
    expect(expressionToSpokenText(operator)).toBe(
      `partial derivative with respect to ${expressionToSpokenText(operator.variable)}`,
    );
  });

  test("planted: dropping the 1/c^2 unbalances it", () => {
    expect(dims(identity(false))).toBe("inconsistent");
  });

  test("planted: an operator with respect to an expression is refused", () => {
    expect(() =>
      parse(
        op({
          kind: "partialOperator",
          variable: op({
            kind: "sum",
            args: [sym("coordinateTimeStationary"), sym("coordinateTimeStationary")],
          }),
        }),
      ),
    ).toThrow(/bound symbol/);
  });
});

describe("an integral with limits", () => {
  // Delta tau = integral from t_0 to t_1 of sqrt(1 - u(t)^2 / c^2) dt: section 4.
  const clock = (lowerQuantity: string) =>
    rel(
      sym("properTimeElapsed"),
      op({
        kind: "integral",
        expression: op({
          kind: "root",
          degree: 2,
          radicand: op({
            kind: "sum",
            args: [
              { kind: "number", value: "1" },
              neg(
                op({
                  kind: "quotient",
                  numerator: sq(sym("particleSpeed", { at: sym("coordinateTimeStationary") })),
                  denominator: sq(sym("speedOfLight")),
                }),
              ),
            ],
          }),
        }),
        variable: sym("coordinateTimeStationary"),
        lower: sym(lowerQuantity, { index: "0" }),
        upper: sym("coordinateTimeStationary", { index: "1" }),
      }),
    );

  test("prints its limits, reads them aloud, and checks", () => {
    const latex = latexOf(clock("coordinateTimeStationary"));
    expect(latex).toContain("\\int_{t_{0}}^{t_{1}}");
    expect(dims(clock("coordinateTimeStationary"))).toBe("consistent");
    const integral = parse(clock("coordinateTimeStationary")) as Extract<
      Expression,
      { kind: "relation" }
    >;
    expect(expressionToSpokenText(integral.right)).toMatch(
      /^integral from .* sub 0 to .* sub 1 of /,
    );
  });

  test("a literal zero limit is admitted for any variable: K = integral from 0 to v", () => {
    const work = rel(
      sym("kineticEnergy"),
      op({
        kind: "integral",
        expression: op({
          kind: "product",
          args: [
            sym("electronMass"),
            op({
              kind: "power",
              base: sym("lorentzFactor", { at: sym("particleSpeed") }),
              exponent: { num: 3, den: 1 },
            }),
            sym("particleSpeed"),
          ],
        }),
        variable: sym("particleSpeed"),
        lower: { kind: "number", value: "0" },
        upper: sym("frameSpeed"),
      }),
    );
    expect(latexOf(work)).toContain("\\int_{0}^{v}");
    expect(dims(work)).toBe("consistent");
  });

  test("planted: a limit with the wrong dimension is caught", () => {
    expect(dims(clock("coordinatePositionStationary"))).toBe("inconsistent");
  });

  test("planted: a single limit is refused", () => {
    const one = op({
      kind: "integral",
      expression: sym("speedOfLight"),
      variable: sym("coordinateTimeStationary"),
      lower: { kind: "number", value: "0" },
    });
    expect(() => parse(rel(sym("coordinatePositionStationary"), one))).toThrow(/both limits/);
  });
});

describe("a power whose exponent is a quantity", () => {
  // W = f^n: the chance that n independent quanta all sit in a fraction f of the volume.
  const w = (base: Expression, exponent: Expression) =>
    rel(sym("configurationProbability"), op({ kind: "symbolPower", base, exponent }));

  test("prints f^n, binds all three quantities, reads aloud, and checks", () => {
    const tree = w(sym("volumeRatio"), sym("quantumCount"));
    expect(latexOf(tree)).toMatch(/f\^\{n\}$/);
    expect(quantityBindings(parse(tree)).map((b) => b.quantityId)).toEqual([
      "configurationProbability",
      "volumeRatio",
      "quantumCount",
    ]);
    expect(dims(tree)).toBe("consistent");
    const power = (parse(tree) as Extract<Expression, { kind: "relation" }>).right;
    expect(expressionToSpokenText(power)).toMatch(/ to the power /);
  });

  test("planted: a base with a dimension cannot take a symbolic exponent", () => {
    expect(dims(w(sym("volume"), sym("quantumCount")))).toBe("inconsistent");
  });

  test("planted: an exponent with a dimension is caught", () => {
    expect(dims(w(sym("volumeRatio"), sym("coordinateTimeStationary")))).toBe("inconsistent");
  });

  test("planted: a number or an expression as the exponent is refused", () => {
    expect(() => parse(w(sym("volumeRatio"), { kind: "number", value: "2" }))).toThrow(
      /one bound symbol/,
    );
    expect(() =>
      parse(
        w(
          sym("volumeRatio"),
          op({ kind: "sum", args: [sym("quantumCount"), sym("quantumCount")] }),
        ),
      ),
    ).toThrow(/one bound symbol/);
  });
});

describe("a partial derivative with a quantity held fixed", () => {
  // (ds/drho)_nu = 1/T: the entropy's response to energy at one frequency is the inverse
  // temperature.
  const d = (extra: Record<string, unknown>, partial = true) =>
    op({
      kind: "derivative",
      expression: sym("spectralEntropyDensity"),
      variable: sym("spectralEnergyDensity"),
      order: 1,
      partial,
      ...extra,
    });
  const law = (derivative: Expression) =>
    rel(
      derivative,
      op({
        kind: "quotient",
        numerator: { kind: "number", value: "1" },
        denominator: sym("temperature"),
      }),
    );

  test("prints the bracket and subscript, binds nu, reads aloud, and checks", () => {
    const tree = law(d({ heldFixed: [sym("frequency")] }));
    expect(latexOf(tree)).toContain("\\right)_{\\nu}");
    expect(quantityBindings(parse(tree)).map((b) => b.quantityId)).toContain("frequency");
    expect(dims(tree)).toBe("consistent");
    const derivative = (parse(tree) as Extract<Expression, { kind: "relation" }>).left;
    expect(expressionToSpokenText(derivative)).toMatch(/ held fixed$/);
  });

  test("planted: holding something fixed changes the tree, so equality sees it", () => {
    // The same tree with heldFixed added and nothing else changed, every other id kept.
    const plain = parse(law(d({}))) as Extract<Expression, { kind: "relation" }>;
    const held = parse({
      ...plain,
      left: { ...plain.left, heldFixed: [sym("frequency")] },
    } as Expression);
    expect(structurallyEqual(plain, plain)).toBe(true);
    expect(structurallyEqual(plain, held)).toBe(false);
  });

  test("planted: a total derivative holds nothing fixed", () => {
    expect(() => parse(law(d({ heldFixed: [sym("frequency")] }, false)))).toThrow(
      /Only a partial derivative/,
    );
  });

  test("planted: the variable that changes cannot also be held fixed", () => {
    expect(() => parse(law(d({ heldFixed: [sym("spectralEnergyDensity")] })))).toThrow(
      /cannot also be held fixed/,
    );
  });
});
