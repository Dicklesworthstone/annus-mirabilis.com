import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareOccupancyEvidence,
  compareOccupancyModels,
  distinguishOccupancy,
  MAX_OCCUPANCY_POINTS,
  OCCUPANCY_CHECKS,
  validateOccupancySettings,
} from "./configurationCountermodels.ts";
import { binomialInside, lockedPositionsProbability } from "./radiation/configurationCounts.ts";

const settings = { n: 4, quarters: 2 };
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

// Independent oracle: enumerate every placement into four equal cells, not a
// factorial, binomial coefficient, or a call back into the production evaluator.
function enumerate(n, quarters) {
  const counts = Array(n + 1).fill(0);
  for (let placement = 0; placement < 4 ** n; placement++) {
    let code = placement,
      inside = 0;
    for (let point = 0; point < n; point++) {
      inside += code % 4 < quarters ? 1 : 0;
      code = Math.floor(code / 4);
    }
    counts[inside]++;
  }
  return counts.map((count) => count / 4 ** n);
}

for (let n = 1; n <= 7; n++) {
  test(`exact occupancy counts agree with exhaustive placements, n=${n}`, () => {
    for (let quarters = 0; quarters <= 4; quarters++) {
      const result = compareOccupancyModels({ n, quarters });
      assert.deepEqual(result.independent.probabilities, enumerate(n, quarters));
    }
  });
}

test("moved public owners retain numeric and rational input behavior", () => {
  assert.deepEqual(
    binomialInside(4, 0.5).terms.map((t) => t.exactProbability.numerator),
    [1n, 4n, 6n, 4n, 1n],
  );
  assert.equal(binomialInside(1, 0.3333331).terms[1].probability, 333333 / 1000000);
  assert.equal(binomialInside(1, 0.3333331).f, 0.3333331);
  assert.equal(binomialInside(4, { p: 3n, q: 4n }).terms[4].exactProbability.numerator, 81n);
  assert.equal(lockedPositionsProbability(4, 0.5).value, 0.5);
  assert.equal(lockedPositionsProbability(400, 0.5).value, 0.5);
});

test("all admitted settings normalize and preserve means but change fluctuations", () => {
  for (let n = 1; n <= MAX_OCCUPANCY_POINTS; n++) {
    for (let quarters = 0; quarters <= 4; quarters++) {
      const r = compareOccupancyModels({ n, quarters }),
        f = quarters / 4;
      for (const model of [r.independent, r.locked]) {
        close(
          model.probabilities.reduce((a, b) => a + b, 0),
          1,
        );
        assert.ok(model.probabilities.every((p) => p >= 0 && p <= 1));
        close(model.statistics["mean-count"], n * f);
        close(model.statistics["one-point"], f);
      }
      close(r.independent.statistics["count-variance"], n * f * (1 - f));
      close(r.locked.statistics["count-variance"], n * n * f * (1 - f));
      close(r.independent.statistics["all-inside"], f ** n);
      close(r.locked.statistics["all-inside"], f);
      assert.equal(
        distinguishOccupancy({ n, quarters }, OCCUPANCY_CHECKS).status,
        n === 1 || quarters === 0 || quarters === 4 ? "underdetermined" : "different-predictions",
      );
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(r)));
    }
  }
});

test("the same mean is insufficient; selecting the joint event or variance is useful", () => {
  for (const checks of [[], ["one-point"], ["mean-count"], ["one-point", "mean-count"]])
    assert.equal(distinguishOccupancy(settings, checks).status, "underdetermined");
  for (const check of ["all-inside", "count-variance"])
    assert.deepEqual(distinguishOccupancy(settings, [check]).different, [check]);
});

test("the full-case entropy is a log constraint weight, including the impossible edge", () => {
  const result = compareOccupancyModels(settings);
  close(result.independent.entropyChange.value, 4 * Math.log(0.5));
  close(result.locked.entropyChange.value, Math.log(0.5));
  for (const key of ["independent", "locked"]) {
    assert.equal(
      compareOccupancyModels({ n: 4, quarters: 0 })[key].entropyChange.kind,
      "zero-probability",
    );
    assert.equal(compareOccupancyModels({ n: 4, quarters: 4 })[key].entropyChange.value, 0);
  }
});

for (const bad of [
  null,
  [],
  {},
  { n: 4 },
  { n: 0, quarters: 2 },
  { n: 13, quarters: 2 },
  { n: 4.5, quarters: 2 },
  { n: NaN, quarters: 2 },
  { n: Infinity, quarters: 2 },
  { n: "4", quarters: 2 },
  { n: 4, quarters: -1 },
  { n: 4, quarters: 5 },
  { n: 4, quarters: 0.5 },
  { n: 4, quarters: "2" },
  { ...settings, verdict: "independent" },
]) {
  test(`refuse invalid settings ${JSON.stringify(bad)}`, () =>
    assert.throws(() => compareOccupancyModels(bad)));
}

test("settings accessors, prototypes and sparse check lists fail without executing code", () => {
  let read = false;
  const input = {
    get n() {
      read = true;
      return 4;
    },
    quarters: 2,
  };
  assert.throws(() => validateOccupancySettings(input));
  assert.equal(read, false);
  assert.throws(() => validateOccupancySettings(Object.create(settings)));
  assert.throws(() => distinguishOccupancy(settings, Array(1)));
  assert.throws(() => distinguishOccupancy(settings, ["mean-count", "mean-count"]));
  assert.throws(() => distinguishOccupancy(settings, ["toString"]));
});

test("a partially occupied placement rules out perfectly locked positions in the ideal model", () => {
  const result = compareOccupancyEvidence(settings, [1, 4, 6, 4, 1]);
  assert.equal(result.trials, 16);
  assert.equal(result.empiricalMean, 2);
  assert.equal(result.empiricalVariance, 1);
  assert.equal(result.empiricalAllInside, 1 / 16);
  assert.equal(result.status, "independent-only");
  assert.deepEqual(result.locked.impossibleCounts, [1, 2, 3]);
  assert.equal(result.logLikelihoodRatio, null);
});

test("all-or-none placements favor locking but do not make independence impossible", () => {
  const result = compareOccupancyEvidence(settings, [8, 0, 0, 0, 8]);
  assert.equal(result.status, "both-possible");
  close(result.logLikelihoodRatio, 16 * Math.log(1 / 8));
  assert.ok(result.independent.logLikelihood < result.locked.logLikelihood);
});

test("histogram likelihood includes multinomial multiplicity", () => {
  const result = compareOccupancyEvidence({ n: 2, quarters: 2 }, [1, 1, 0]);
  close(Math.exp(result.independent.logLikelihood), 2 * 0.25 * 0.5);
});

test("one point supplies no independence evidence", () => {
  const result = compareOccupancyEvidence({ n: 1, quarters: 1 }, [17, 3]);
  assert.equal(result.status, "both-possible");
  assert.equal(result.logLikelihoodRatio, 0);
});

test("boundary contradictions reject BOTH candidates, not the inconvenient one", () => {
  assert.equal(
    compareOccupancyEvidence({ n: 4, quarters: 0 }, [0, 1, 0, 0, 0]).status,
    "neither-possible",
  );
  assert.equal(
    compareOccupancyEvidence({ n: 4, quarters: 4 }, [1, 0, 0, 0, 0]).status,
    "neither-possible",
  );
  const exact = compareOccupancyEvidence({ n: 4, quarters: 0 }, [10, 0, 0, 0, 0]);
  assert.equal(exact.status, "both-possible");
  assert.equal(exact.logLikelihoodRatio, 0);
  assert.equal(exact.independent.logLikelihood, 0);
});

test("tiny positive likelihoods remain possible, even when exponentiating would underflow", () => {
  const counts = Array(13).fill(0);
  counts[12] = 10000;
  const result = compareOccupancyEvidence({ n: 12, quarters: 1 }, counts);
  assert.equal(result.status, "both-possible");
  assert.ok(Number.isFinite(result.independent.logLikelihood));
  assert.equal(Math.exp(result.independent.logLikelihood), 0);
  close(result.logLikelihoodRatio, 110000 * Math.log(0.25), 1e-8);
});

for (const bad of [
  null,
  [],
  [0, 0, 0, 0, 0],
  [1, 2],
  [1, -1, 0, 0, 0],
  [1, 0.5, 0, 0, 0],
  ["1", 0, 0, 0, 0],
  [Infinity, 0, 0, 0, 0],
  [NaN, 0, 0, 0, 0],
  [10001, 0, 0, 0, 0],
  Array(5),
]) {
  test(`refuse invalid evidence ${JSON.stringify(bad)}`, () =>
    assert.throws(() => compareOccupancyEvidence(settings, bad)));
}

test("evidence accessors do not execute and accepted data has no mutable aliases", () => {
  let read = false;
  const accessor = [0, 0, 0, 0, 0];
  Object.defineProperty(accessor, "0", {
    get() {
      read = true;
      return 1;
    },
  });
  assert.throws(() => compareOccupancyEvidence(settings, accessor));
  assert.equal(read, false);
  const input = [1, 4, 6, 4, 1],
    result = compareOccupancyEvidence(settings, input);
  input[0] = 999;
  assert.equal(result.counts[0], 1);
  assert.ok(Object.isFrozen(result.counts));
  assert.ok(Object.isFrozen(result.locked.impossibleCounts));
});
