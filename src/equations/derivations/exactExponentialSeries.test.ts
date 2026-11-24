import { expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import { MASS_ENERGY_QUANTITIES as registry } from "../massEnergyQuantities.ts";
import { exactSeriesAtZero, monomialQuotientLimit, SeriesRefusal } from "./exactSeries.ts";

const equationId = "eq-model-exponential-series-test";
const number = (value: string): Expression => ({ kind: "number", value });
const symbol = (quantityId: string): Expression => ({
  kind: "symbol",
  quantityId,
  termId: "internal",
});
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const exponential = (argument: Expression): Expression => ({
  kind: "function",
  name: "exp",
  argument,
});
const x: Expression = {
  kind: "quotient",
  numerator: symbol("frameSpeed"),
  denominator: symbol("speedOfLight"),
};
const square: Expression = { kind: "power", base: x, exponent: { num: 2, den: 1 } };
function request(expression: Expression, order = 6) {
  let next = 0;
  function stamp(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stamp);
    if (!value || typeof value !== "object") return value;
    const copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stamp(item)]));
    if (copy.kind === "symbol") copy.termId = `${equationId}.t.n${next++}`;
    else if (copy.kind && copy.kind !== "number" && copy.kind !== "constant")
      copy.opId = `${equationId}.op.n${next++}`;
    return copy;
  }
  return {
    expression: stamp(expression) as Expression,
    equationId,
    registry,
    variable: { numerator: "frameSpeed", denominator: "speedOfLight" },
    order,
  };
}

test("the exponential recurrence produces exact factorial coefficients without samples", () => {
  const jet = exactSeriesAtZero(request(exponential(x)));
  expect(jet.coefficients).toEqual(["1", "1", "1/2", "1/6", "1/24", "1/120", "1/720"]);
  expect(jet.regularity).toBe("real-analytic-near-zero");
  expect(jet.scope).toBe("local-series-not-finite-error-bound");
  expect(exactSeriesAtZero(request(exponential(product(number("-1"), x)), 4)).coefficients).toEqual(
    ["1", "-1", "1/2", "-1/6", "1/24"],
  );
});

test("composition uses the supplied analytic argument and the derivative recurrence", () => {
  expect(
    exactSeriesAtZero(request(exponential(sum(product(number("2"), x), square)), 4)).coefficients,
  ).toEqual(["1", "2", "3", "10/3", "19/6"]);
  expect(
    exactSeriesAtZero(request(product(exponential(x), exponential(product(number("-1"), x))), 8))
      .coefficients,
  ).toEqual(["1", ...Array(8).fill("0")]);
  expect(exactSeriesAtZero(request(exponential(number("0")), 0)).coefficients).toEqual(["1"]);
});

test("the existing removable-limit owner proves the first exponential difference quotient", () => {
  const result = monomialQuotientLimit(request(sum(exponential(x), number("-1"))), 1);
  expect(result.limit).toBe("1");
  expect(result.quotientAtZero).toBe("not-applicable");
  expect(result.coefficients).toEqual(["1", "1/2", "1/6", "1/24", "1/120", "1/720"]);
  expect(
    monomialQuotientLimit(request(sum(exponential(product(number("2"), x)), number("-1"))), 1)
      .limit,
  ).toBe("2");
  expect(monomialQuotientLimit(request(sum(exponential(square), number("-1"))), 1).limit).toBe("0");
  expect(monomialQuotientLimit(request(sum(exponential(square), number("-1"))), 2).limit).toBe("1");
});

test("nonzero exponential origins are refused exactly, including a tiny residual", () => {
  for (const origin of ["1", "-1", "1e-100"])
    for (const order of [0, 6]) {
      try {
        exactSeriesAtZero(request(exponential(sum(x, number(origin))), order));
        throw new Error("A nonzero origin must not receive a rational exponential jet.");
      } catch (error) {
        expect(error).toBeInstanceOf(SeriesRefusal);
        if (error instanceof SeriesRefusal) expect(error.code).toBe("exponential-origin-not-zero");
      }
    }
});

test("the extension does not accept other functions, unremoved poles or undefined hidden factors", () => {
  const pole: Expression = { kind: "quotient", numerator: number("1"), denominator: x };
  for (const expression of [
    { kind: "function", name: "sin", argument: x } as Expression,
    exponential(pole),
    product(number("0"), exponential(pole)),
    { kind: "power", base: exponential(pole), exponent: { num: 0, den: 1 } } as Expression,
  ])
    expect(() => exactSeriesAtZero(request(expression))).toThrow(SeriesRefusal);
  expect(() => monomialQuotientLimit(request(sum(exponential(x), number("1"))), 1)).toThrow(
    SeriesRefusal,
  );
  expect(() =>
    monomialQuotientLimit(request(sum(exponential(x), number("-1"), number("1e-100"))), 1),
  ).toThrow(SeriesRefusal);
});
