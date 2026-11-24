import { describe, expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import {
  type ClassicalCutoffInput,
  classicalCutoffInput as classical,
  classicalCutoffCheckRows,
  lqFoundationExpressions as e,
  type IndependentEntropyInput,
  independentEntropyInput as independent,
  independentEntropyCheckRows,
  foundationLog as log,
  foundationNumber as number,
  lqFoundationSymbols as p,
  foundationProduct as product,
  foundationRelation as relation,
} from "./lightQuantaFoundations.ts";
import { verifyClassicalCutoff, verifyIndependentEntropy } from "./lightQuantaFoundationsProof.ts";

const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});

describe("the classical cutoff follows from an admitted positive-temperature spectrum", () => {
  test("the real equations establish the primitive, endpoints and unbounded doubling identity", () => {
    const checked = verifyClassicalCutoff();
    expect(checked.passed).toBe(true);
    expect(checked.rows.filter((row) => row.passed).map((row) => row.id)).toEqual([
      ...classicalCutoffCheckRows,
    ]);
    expect(checked.rows.find((row) => row.id === "classical-unbounded-growth")?.reason).toContain(
      "every positive cutoff",
    );
  });

  test("an antiderivative's arbitrary constant cannot disappear at the lower endpoint", () => {
    const checked = verifyClassicalCutoff({
      ...classical,
      primitive: sum(classical.primitive, number("7")),
    });
    expect(checked.rows.find((row) => row.id === "classical-antiderivative")?.passed).toBe(true);
    expect(checked.rows.find((row) => row.id === "classical-zero-boundary")?.passed).toBe(false);
    expect(checked.passed).toBe(false);
  });

  test("wrong coefficients, powers, signs and a changed density fail the exact argument", () => {
    const wrongTotals = [
      product(number("3"), e.total.right),
      negative(e.total.right),
      quotient(e.total.right, p.cutoff),
    ];
    for (const right of wrongTotals)
      expect(
        verifyClassicalCutoff({ ...classical, total: relation(e.total.left, right) }).passed,
      ).toBe(false);
    expect(
      verifyClassicalCutoff({
        ...classical,
        primitive: product(number("2"), classical.primitive),
        total: relation(e.total.left, product(number("2"), e.total.right)),
      }).passed,
    ).toBe(false);
    expect(
      verifyClassicalCutoff({
        ...classical,
        density: relation(e.density.left, product(number("2"), e.density.right)),
      }).passed,
    ).toBe(false);
  });

  test("the integral keeps its bounds, integration variable and cutoff binding", () => {
    const integral = e.integral.right as Extract<Expression, { kind: "integral" }>;
    for (const changed of [
      { ...integral, lower: p.cutoff, upper: p.zero },
      { ...integral, variable: p.cutoff },
      { ...integral, upper: product(number("2"), p.cutoff) },
    ]) {
      expect(
        verifyClassicalCutoff({ ...classical, integral: relation(e.integral.left, changed) })
          .passed,
      ).toBe(false);
      expect(
        verifyClassicalCutoff({
          ...classical,
          substitutedIntegral: relation(e.integral.left, changed),
        }).passed,
      ).toBe(false);
    }
    expect(
      verifyClassicalCutoff({
        ...classical,
        total: relation(
          { ...(e.total.left as Extract<Expression, { kind: "symbol" }>), at: p.nu },
          e.total.right,
        ),
      }).passed,
    ).toBe(false);
  });

  test("a finite numerical multiplier cannot replace the universal cubic growth identity", () => {
    for (const multiplier of ["1", "2", "4", "16"])
      expect(
        verifyClassicalCutoff({
          ...classical,
          growth: relation(e.growth.left, product(number(multiplier), e.total.left)),
        }).passed,
      ).toBe(false);
    expect(
      verifyClassicalCutoff({ ...classical, growth: relation(e.total.left, e.growth.right) })
        .passed,
    ).toBe(false);
  });

  test("missing premises or an omitted transformation cannot keep checked support", () => {
    for (const removed of classical.premises)
      expect(
        verifyClassicalCutoff({
          ...classical,
          premises: classical.premises.filter((id) => id !== removed),
        }).passed,
      ).toBe(false);
    for (const field of [
      "density",
      "integral",
      "substitutedIntegral",
      "primitive",
      "total",
      "growth",
    ] as const)
      expect(
        verifyClassicalCutoff({
          ...classical,
          [field]: undefined,
        } as unknown as ClassicalCutoffInput).passed,
      ).toBe(false);
  });

  test("unsupported or concealed undefined expressions fail closed", () => {
    const primitive: Record<string, unknown> = { kind: "product", args: [] };
    primitive.args = [primitive];
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, "kind", {
      enumerable: true,
      get() {
        getterCalls++;
        return "number";
      },
    });
    const accessorArray = Object.defineProperty([p.nu], "0", {
      enumerable: true,
      get() {
        getterCalls++;
        return p.nu;
      },
    });
    for (const value of [
      primitive,
      accessor,
      { kind: "product", args: accessorArray },
      { kind: "constant", name: "infinity" },
      product(number("0"), log(negative(p.nu))),
      { ...p.nu, at: p.nu },
    ])
      expect(verifyClassicalCutoff({ ...classical, primitive: value as Expression }).passed).toBe(
        false,
      );
    expect(getterCalls).toBe(0);
    expect(
      verifyClassicalCutoff({
        ...classical,
        density: { kind: "relation", operator: "=" } as Expression,
      }).passed,
    ).toBe(false);
  });
});

describe("the independent-point entropy is conditional on its statistical premises", () => {
  test("symbolic substitution and the positive-power logarithm prove the supplied chained equality", () => {
    const checked = verifyIndependentEntropy();
    expect(checked.passed).toBe(true);
    expect(checked.rows.filter((row) => row.passed).map((row) => row.id)).toEqual([
      ...independentEntropyCheckRows,
    ]);
  });

  test("a correlated probability cannot inherit the independent-count coefficient", () => {
    expect(
      verifyIndependentEntropy({ ...independent, probability: relation(p.W, p.f) }).passed,
    ).toBe(false);
    const alteredExponent: Expression = {
      kind: "symbolPower",
      base: p.f,
      exponent: sum(p.n, p.one),
    };
    expect(
      verifyIndependentEntropy({ ...independent, probability: relation(p.W, alteredExponent) })
        .passed,
    ).toBe(false);
    expect(
      verifyIndependentEntropy({
        ...independent,
        probability: relation(p.W, {
          kind: "symbolPower",
          base: { ...p.f, index: "x" },
          exponent: p.n,
        }),
      }).passed,
    ).toBe(false);
  });

  test("a missing count, sign change or reciprocal fraction does not satisfy the logarithm identity", () => {
    for (const right of [
      log(p.f),
      negative(e.logarithm.right),
      product(sum(p.n, p.one), log(p.f)),
      product(p.n, log(quotient(p.one, p.f))),
    ])
      expect(
        verifyIndependentEntropy({ ...independent, logarithm: relation(e.logarithm.left, right) })
          .passed,
      ).toBe(false);
  });

  test("the conclusion consumes the same Boltzmann coefficient and the proved logarithm", () => {
    const reversed = verifyIndependentEntropy({
      ...independent,
      entropy: relation(e.entropy.left, negative(e.entropy.right)),
    });
    expect(reversed.rows.find((row) => row.id === "independent-reference-boundaries")?.passed).toBe(
      true,
    );
    expect(reversed.rows.find((row) => row.id === "independent-entropy-conclusion")?.passed).toBe(
      false,
    );
    expect(reversed.passed).toBe(false);
    for (const right of [product(p.k, log(p.f)), product(number("2"), e.entropy.right)])
      expect(
        verifyIndependentEntropy({ ...independent, entropy: relation(e.entropy.left, right) })
          .passed,
      ).toBe(false);
    expect(
      verifyIndependentEntropy({
        ...independent,
        principle: relation(e.principle.left, product(number("2"), e.principle.right)),
      }).passed,
    ).toBe(false);
  });

  test("all physical and positive-domain premises and every input remain necessary", () => {
    for (const removed of independent.premises)
      expect(
        verifyIndependentEntropy({
          ...independent,
          premises: independent.premises.filter((id) => id !== removed),
        }).passed,
      ).toBe(false);
    for (const field of [
      "probability",
      "principle",
      "substitutedEntropy",
      "logarithm",
      "entropy",
    ] as const)
      expect(
        verifyIndependentEntropy({
          ...independent,
          [field]: undefined,
        } as unknown as IndependentEntropyInput).passed,
      ).toBe(false);
    expect(
      verifyIndependentEntropy({
        ...independent,
        logarithm: relation(e.logarithm.left, product(p.n, log(p.zero))),
      }).passed,
    ).toBe(false);
  });
});
