import { describe, expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import { logarithmicCalculus, LogarithmicCalculusRefusal } from "./logarithmicCalculus.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
const symbol = (id: string): Symbol => ({ kind: "symbol", termId: id, quantityId: id });
const number = (value: string): Expression => ({ kind: "number", value });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const quotient = (numerator: Expression, denominator: Expression): Expression =>
  ({ kind: "quotient", numerator, denominator });
const log = (argument: Expression): Expression => ({ kind: "function", name: "ln", argument });
const power = (base: Expression, num: number): Expression =>
  ({ kind: "power", base, exponent: { num, den: 1 } });
const x = symbol("density");
const a = symbol("scale");
const nu = symbol("frequency");
const V = symbol("volume");
const V0: Symbol = { ...V, termId: "volume[0]", index: "0" };
const C: Symbol = { ...symbol("constant(frequency)"), at: nu };
const calculus = logarithmicCalculus({ positive: [x, a, nu, V, V0], constants: [C] });
const zero = number("0");
const one = number("1");
const primitive = sum(product(x, log(quotient(x, a))), negative(x), C);

function refused(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof LogarithmicCalculusRefusal) return error.code;
    throw error;
  }
  throw new Error("Expected a bounded logarithmic-calculus refusal.");
}

describe("exact logarithmic algebra and one-sided calculus", () => {
  test("positive quotient logarithms preserve the reference-volume binding and sign", () => {
    const comparison = sum(
      log(quotient(x, product(V0, a))),
      negative(log(quotient(x, product(V, a)))),
    );
    expect(calculus.equal(comparison, log(quotient(V, V0)))).toBe(true);
    expect(calculus.equal(comparison, log(quotient(V0, V)))).toBe(false);
    expect(calculus.equal(comparison, log(quotient(V, V)))).toBe(false);
    expect(calculus.equal(log(quotient(V, V)), zero)).toBe(true);
  });

  test("differentiation proves the logarithmic primitive with a frequency-dependent constant", () => {
    const slope = log(quotient(x, a));
    expect(calculus.differentiatesTo(primitive, x, slope)).toBe(true);
    expect(calculus.differentiatesTo(primitive, x, negative(slope))).toBe(false);
    const missingLinearTerm = sum(product(x, slope), C);
    expect(calculus.differentiatesTo(missingLinearTerm, x, slope)).toBe(false);
    expect(calculus.differentiatesTo(quotient(one, x), x, negative(quotient(one, power(x, 2)))))
      .toBe(true);
  });

  test("the zero-density limit retains C(ν), so an unfixed constant cannot disappear", () => {
    expect(calculus.tendsToAtZero(primitive, x, C)).toBe(true);
    expect(calculus.tendsToAtZero(primitive, x, zero)).toBe(false);
    expect(calculus.tendsToAtZero(sum(primitive, negative(C)), x, zero)).toBe(true);
    expect(calculus.tendsToAtZero(product(power(x, 2), power(log(x), 3)), x, zero)).toBe(true);
    expect(calculus.tendsToAtZero(sum(log(x), negative(log(x)), C), x, C)).toBe(true);
  });

  test("arithmetic is exact beyond binary floating-point integer precision", () => {
    const difference = sum(number("9007199254740993"), negative(number("9007199254740992")));
    expect(calculus.equal(difference, one)).toBe(true);
    expect(calculus.equal(difference, zero)).toBe(false);
    expect(calculus.differentiatesTo(product(number("0.1"), x), x, quotient(one, number("10"))))
      .toBe(true);
  });

  test("logarithmic-calculus-unsupported: mutating the caller's array cannot change the positive domain", () => {
    const positive = [x];
    const fixed = logarithmicCalculus({ positive, constants: [C] });
    positive.push(a);
    expect(refused(() => fixed.equal(log(C), log(C))))
      .toBe("logarithmic-calculus-unsupported");
    expect(refused(() => fixed.equal(a, a)))
      .toBe("logarithmic-calculus-unsupported");
    positive[0] = a;
    expect(fixed.differentiatesTo(x, x, one)).toBe(true);
    expect(refused(() => fixed.differentiatesTo(x, a, zero)))
      .toBe("logarithmic-calculus-unsupported");
  });

  test("logarithmic-calculus-unsupported: dependence on the integration variable is not a constant", () => {
    for (const at of [x, product(nu, x)]) {
      const dependent: Symbol = { ...C, at };
      const invalid = logarithmicCalculus({ positive: [x, nu], constants: [dependent] });
      expect(refused(() => invalid.differentiatesTo(dependent, x, zero)))
        .toBe("logarithmic-calculus-unsupported");
      expect(refused(() => invalid.tendsToAtZero(dependent, x, zero)))
        .toBe("logarithmic-calculus-unsupported");
    }
  });

  // Refusal evidence: src/equations/derivations/logarithmicCalculus.ts:34
  test("logarithmic-calculus-unsupported: logs and denominators need declared positive monomials", () => {
    for (const expression of [
      log(C), log(negative(x)), log(sum(x, a)), log(product(number("2"), x)),
      quotient(x, C), quotient(x, sum(x, a)), quotient(x, zero),
      product(zero, log(negative(x))),
    ]) {
      expect(refused(() => calculus.equal(expression, zero)))
        .toBe("logarithmic-calculus-unsupported");
    }
  });

  test("logarithmic-calculus-unsupported: divergent zero limits cannot count as a boundary proof", () => {
    for (const expression of [log(x), quotient(one, x), product(quotient(one, x), log(x))])
      expect(refused(() => calculus.tendsToAtZero(expression, x, zero)))
        .toBe("logarithmic-calculus-unsupported");
  });

  test("logarithmic-calculus-unsupported: unsupported functions, powers and bindings are refused", () => {
    for (const expression of [
      { kind: "function", name: "exp", argument: x } as Expression,
      power(x, 17), power(x, -1),
      { ...C, at: a } as Symbol,
      { ...x, scale: { num: 2, den: 1 } } as Symbol,
    ])
      expect(refused(() => calculus.equal(expression, expression)))
        .toBe("logarithmic-calculus-unsupported");
    expect(refused(() => calculus.differentiatesTo(x, symbol("unbound"), one)))
      .toBe("logarithmic-calculus-unsupported");
    expect(refused(() => logarithmicCalculus({ positive: [x, x] })))
      .toBe("logarithmic-calculus-unsupported");
  });
});
