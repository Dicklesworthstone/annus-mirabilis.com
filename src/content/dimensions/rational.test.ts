import { describe, expect, it } from "bun:test";
import {
  add,
  divide,
  multiply,
  parseRational,
  rational,
} from "./rational.ts";
import { TestLogger, newRunIdentity } from "../../testing/log/logger.ts";

describe("Exact Rational Dimension Arithmetic", () => {
  const logger = new TestLogger("dimension-validator-tests", newRunIdentity());

  it("normalizes fractions to lowest terms with positive denominator", () => {
    const r1 = rational(2n, 4n);
    expect(r1).toEqual({ num: 1n, den: 2n });

    const r2 = rational(-1n, -2n);
    expect(r2).toEqual({ num: 1n, den: 2n });

    const r3 = rational(3n, -9n);
    expect(r3).toEqual({ num: -1n, den: 3n });
  });

  it("computes product of 200 factors of 3/7 staying exact without float rounding or overflow", () => {
    let acc = rational(1n, 1n);
    const factor = parseRational("3/7");

    for (let i = 0; i < 200; i++) {
      acc = multiply(acc, factor);
    }

    const expectedNum = 3n ** 200n;
    const expectedDen = 7n ** 200n;

    expect(acc.num).toBe(expectedNum);
    expect(acc.den).toBe(expectedDen);

    logger.log({
      testId: "rational-200-factor-product",
      beadId: "am-cm-dimension-validator-aoz",
      expected: "3^200 / 7^200",
      actual: `${acc.num} / ${acc.den}`,
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: { numDigits: acc.num.toString().length },
    });
  });

  it("refuses division by zero rational", () => {
    const a = parseRational("1/2");
    const zero = parseRational("0");

    expect(() => divide(a, zero)).toThrow("zero rational");
    expect(() => rational(1n, 0n)).toThrow("denominator cannot be zero");
  });
});
