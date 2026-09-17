import assert from "node:assert/strict";
import test from "node:test";
import { withinTolerance } from "../units/tolerance.ts";
import { writeCalculusLog } from "./foundCalculus.logger.ts";

test("foundCalculus.logarithm.property: product-to-sum ln(W1 * W2) = ln(W1) + ln(W2)", () => {
  // Deterministic set of test cases spanning multiple orders of magnitude
  const pairs: [number, number][] = [
    [2, 3],
    [4, 8],
    [0.5, 0.25],
    [1e-4, 1e6],
    [Math.PI, Math.E],
    [100, 200],
    [0.12345, 678.9],
    [137.036, 1836.15],
  ];

  // Property test across 50 random positive inputs spanning 1e-6 to 1e6
  for (let i = 0; i < 50; i++) {
    const w1 = Math.exp((Math.random() - 0.5) * 20); // ~e^-10 to e^10
    const w2 = Math.exp((Math.random() - 0.5) * 20);
    pairs.push([w1, w2]);
  }

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

  writeCalculusLog({
    testId: "logarithm-product-to-sum-property",
    foundationId: "logarithms",
    callingAnchor: "light-quanta:s5",
    expected: "ln(W1 * W2) == ln(W1) + ln(W2)",
    actual: "identity holds across 58 deterministic and random positive test pairs",
    tolerance: { relative: 1e-12, absolute: 1e-12 },
    outcome: "passed",
    message:
      "Verified product-to-sum property ln(W1 * W2) = ln(W1) + ln(W2) across random positive inputs",
  });
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

  writeCalculusLog({
    testId: "logarithm-quotient-to-diff-property",
    foundationId: "logarithms",
    callingAnchor: "light-quanta:s4",
    expected: "ln(W1 / W2) == ln(W1) - ln(W2)",
    actual: "identity holds across test pairs",
    tolerance: { relative: 1e-12, absolute: 1e-12 },
    outcome: "passed",
    message: "Verified quotient-to-difference property ln(W1 / W2) = ln(W1) - ln(W2)",
  });
});
