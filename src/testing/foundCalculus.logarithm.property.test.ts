import assert from "node:assert/strict";
import test from "node:test";
import { withinTolerance } from "../units/tolerance.ts";

test("foundCalculus.logarithm.property: product-to-sum ln(W1 * W2) = ln(W1) + ln(W2)", () => {
  // Deterministic set of test cases spanning multiple orders of magnitude
  const pairs = [
    [2, 3],
    [4, 8],
    [0.5, 0.25],
    [1e-4, 1e6],
    [Math.PI, Math.E],
    [100, 200],
    [0.12345, 678.9],
    [137.036, 1836.15],
  ];

  for (const [w1, w2] of pairs) {
    if (w1 === undefined || w2 === undefined) continue;
    const lhs = Math.log(w1 * w2);
    const rhs = Math.log(w1) + Math.log(w2);

    const verdict = withinTolerance(lhs, rhs, { relative: 1e-12, absolute: 1e-12 });
    assert.equal(
      verdict.ok,
      true,
      `Product-to-sum failed for W1=${w1}, W2=${w2}: diff=${verdict.diff}`,
    );
  }
});

test("foundCalculus.logarithm.property: quotient-to-difference ln(W1 / W2) = ln(W1) - ln(W2)", () => {
  const pairs = [
    [10, 2],
    [1000, 10],
    [0.5, 2],
    [6.17e23, 1e19],
  ];

  for (const [w1, w2] of pairs) {
    if (w1 === undefined || w2 === undefined) continue;
    const lhs = Math.log(w1 / w2);
    const rhs = Math.log(w1) - Math.log(w2);

    const verdict = withinTolerance(lhs, rhs, { relative: 1e-12, absolute: 1e-12 });
    assert.equal(
      verdict.ok,
      true,
      `Quotient-to-difference failed for W1=${w1}, W2=${w2}: diff=${verdict.diff}`,
    );
  }
});
