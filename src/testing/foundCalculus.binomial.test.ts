import assert from "node:assert/strict";
import test from "node:test";
import {
  binomialPartialSumsGamma,
  gammaMinusOneCancellationFree,
  gammaMinusOneNaive,
} from "../foundations/calculus.ts";
import { withinTolerance } from "../units/tolerance.ts";

test("foundCalculus.binomial: partial sums at x = 0.36 match 0.18, 0.2286, 0.24318, 0.247773 against exact 0.25", () => {
  const x = 0.36; // corresponding to v/c = 0.6
  const res = binomialPartialSumsGamma(x);

  assert.equal(withinTolerance(res.exact, 0.25, { absolute: 1e-12 }).ok, true);

  // Term 1 (1/2 * x = 0.18)
  assert.equal(withinTolerance(res.partialSums[0], 0.18, { absolute: 1e-6 }).ok, true);

  // Term 1+2 (0.18 + 3/8 * 0.36^2 = 0.2286)
  assert.equal(withinTolerance(res.partialSums[1], 0.2286, { absolute: 1e-6 }).ok, true);

  // Term 1+2+3 (0.2286 + 5/16 * 0.36^3 = 0.24318)
  assert.equal(withinTolerance(res.partialSums[2], 0.24318, { absolute: 1e-6 }).ok, true);

  // Term 1+2+3+4 (0.24318 + 35/128 * 0.36^4 = 0.2477727...)
  assert.equal(withinTolerance(res.partialSums[3], 0.247773, { absolute: 1e-5 }).ok, true);
});

test("foundCalculus.binomial: cancellation-free gamma - 1 at v/c = 1e-4 gives 5.0000000375e-9", () => {
  const vOverC = 1e-4;
  const x = vOverC * vOverC; // 1e-8
  const firstTerm = 0.5 * x; // 5.0e-9

  const stableVal = gammaMinusOneCancellationFree(vOverC);
  const expectedVal = 5.0000000375e-9;

  const vStable = withinTolerance(stableVal, expectedVal, { absolute: 1e-18, relative: 1e-10 });
  assert.equal(
    vStable.ok,
    true,
    `Cancellation-free gamma - 1 must match 5.0000000375e-9, got ${stableVal}`,
  );

  // Relative difference to first term is 7.500000e-9 (which is exactly 3/4 * x)
  const relDiff = (stableVal - firstTerm) / firstTerm;
  const expectedRelDiff = 7.5e-9;
  const vRel = withinTolerance(relDiff, expectedRelDiff, { absolute: 1e-15, relative: 1e-8 });
  assert.equal(vRel.ok, true, `Relative difference must match 7.5e-9, got ${relDiff}`);

  // Planted negative: Naive 1/sqrt(1 - x) - 1 produces precision loss
  const naiveVal = gammaMinusOneNaive(vOverC);
  const naiveRelDiff = (naiveVal - firstTerm) / firstTerm;

  // Naive value is approximately 5.0000001917e-9, differing substantially from exact
  assert.notEqual(
    withinTolerance(naiveVal, expectedVal, { absolute: 1e-16, relative: 1e-10 }).ok,
    true,
    "Naive float evaluation must fail high-precision check due to catastrophic cancellation",
  );
  assert.notEqual(
    withinTolerance(naiveRelDiff, expectedRelDiff, { relative: 1e-2 }).ok,
    true,
    "Naive relative difference (approx 3.83e-8) is over 5x too large compared to true 7.5e-9",
  );
});
