import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  binomialPartialSumsGamma,
  gammaMinusOneCancellationFree,
  gammaMinusOneNaive,
  logarithmPower,
} from "../foundations/calculus.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { writeCalculusLog } from "./foundCalculus.logger.ts";

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

  writeCalculusLog({
    testId: "binomial-partial-sums-gamma-x036",
    foundationId: "taylor-expansion",
    callingAnchor: "special-relativity:s4",
    expected: [0.18, 0.2286, 0.24318, 0.247773],
    actual: res.partialSums,
    tolerance: { absolute: 1e-5 },
    outcome: "passed",
    message:
      "Verified binomial series partial sums for (1 - x)^(-1/2) - 1 at x = 0.36 against exact 0.25",
  });
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

  // Retain planted failure evidence beside logs
  const evidenceDir = path.resolve(process.cwd(), "artifacts/test-logs/found-calculus/evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, "naive-cancellation-failure.json");
  const evidenceData = {
    exampleId: "binomial-gamma-minus-one-naive",
    vOverC,
    expectedVal,
    expectedRelDiff,
    actualNaiveVal: naiveVal,
    actualNaiveRelDiff: naiveRelDiff,
    evaluationRouteUsed: "naive-floating-point-subtraction: 1/sqrt(1 - x) - 1",
    stableEvaluationRoute: "cancellation-free-expansion: x / (sqrt(1 - x) * (1 + sqrt(1 - x)))",
    failureExplanation:
      "Direct subtraction of 1 from 1/sqrt(1 - 1e-8) in IEEE-754 binary64 suffers catastrophic cancellation, yielding 5.0000001917e-9 instead of true 5.0000000375e-9",
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(evidenceFile, JSON.stringify(evidenceData, null, 2), "utf8");

  writeCalculusLog({
    testId: "cancellation-free-gamma-minus-one",
    foundationId: "taylor-expansion",
    callingAnchor: "mass-energy",
    expected: { gammaMinusOne: expectedVal, relDiff: expectedRelDiff },
    actual: {
      stableVal,
      stableRelDiff: relDiff,
      plantedNaiveVal: naiveVal,
      plantedNaiveRelDiff: naiveRelDiff,
    },
    tolerance: { absolute: 1e-18, relative: 1e-10 },
    outcome: "passed",
    evidence: {
      path: "artifacts/test-logs/found-calculus/evidence/naive-cancellation-failure.json",
    },
    message:
      "Verified cancellation-free gamma - 1 gives 5.0000000375e-9; planted naive route fails assertion and failure evidence is retained",
  });
});

/**
 * Domain refusals (am-muyh).
 *
 * A plant sweep found all three of calculus.ts's guards deletable with every
 * test that reaches the module green. Without them the functions do not fail,
 * they return NaN: binomialPartialSumsGamma(1.2) hands back an `exact` of NaN
 * with four finite partial sums beside it, and gammaMinusOneCancellationFree
 * at v/c = 1 returns Infinity. AGENTS.md's doctrine 8 forbids exactly that:
 * a refusal is a typed state, never a silent NaN or infinity.
 */
test("foundCalculus.domain: logarithmPower refuses a non-positive argument and accepts a positive one", () => {
  assert.throws(() => logarithmPower(0, 2), RangeError);
  assert.throws(() => logarithmPower(-1, 2), /Logarithm argument must be positive/);
  // Accept: the identity the refusal protects still evaluates.
  assert.equal(
    withinTolerance(logarithmPower(0.5, 10), 10 * Math.log(0.5), { absolute: 1e-12 }).ok,
    true,
  );
});

test("foundCalculus.domain: the binomial expansion refuses x outside [0, 1) rather than returning NaN", () => {
  for (const x of [-0.1, 1, 1.2, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => binomialPartialSumsGamma(x),
      /x must be in \[0, 1\) for binomial expansion/,
      `x = ${x} is outside the series' domain and must be refused, not evaluated`,
    );
  }
  // Accept: both ends of the admitted interval.
  assert.equal(binomialPartialSumsGamma(0).exact, 0);
  assert.equal(Number.isFinite(binomialPartialSumsGamma(0.9999).exact), true);
});

test("foundCalculus.domain: gamma - 1 refuses |v/c| >= 1, the speed no inertial observer has", () => {
  for (const vOverC of [1, -1, 1.5, 2]) {
    assert.throws(
      () => gammaMinusOneCancellationFree(vOverC),
      /v\/c must be strictly less than 1/,
      `v/c = ${vOverC} admits no inertial observer and must be refused`,
    );
  }
  // Accept: just inside the boundary, and the low-speed case the function exists for.
  assert.equal(Number.isFinite(gammaMinusOneCancellationFree(0.999999)), true);
  assert.equal(
    withinTolerance(gammaMinusOneCancellationFree(1e-4), 5.0000000375e-9, { relative: 1e-9 }).ok,
    true,
  );

  // The naive route has no guard by design; it is the counter-demonstration,
  // and it returns Infinity where the audited route refuses.
  assert.equal(gammaMinusOneNaive(1), Number.POSITIVE_INFINITY);
});
