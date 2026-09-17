// Run with the complete repository, not only the additive patch source tree.
// These use the real reference owners and no numerical mocks.
import assert from "node:assert/strict";
import test from "node:test";
import { parseTrajectoryCsv } from "../experiments/bm07/trajectoryCsv.ts";
import { analyzeImportedTrajectory } from "../experiments/bm07/trajectoryHost.ts";

const units = { time: "s", position: "um" };
const model = {
  estimator: "independent-increment-known-zero-drift",
  coverage: 0.95,
  independentIsotropic: true,
  commonDriftAndDiffusion: false,
  localizationStd: 0,
  exposureTime: 0,
  censored: false,
  independentRadius: null,
};
const close = (actual, expected, tolerance = 1e-7) =>
  assert.ok(
    Math.abs(actual - expected) <= Math.abs(expected) * tolerance,
    `${actual} != ${expected}`,
  );
const calculate = (csv, overrides = {}, calibration = units) =>
  analyzeImportedTrajectory(parseTrajectoryCsv(csv, calibration), { ...model, ...overrides });

test("reference integration: 2D one-increment estimate and analytic df=2 interval", () => {
  const result = calculate("time,x,y\n0,0,0\n1,1,2");
  assert.equal(result.kind, "analyzed");
  assert.equal(result.estimate.q, 2);
  close(result.estimate.dHat, 1.25e-12);
  close(result.interval.lower, 2.5e-12 / (-2 * Math.log(0.025)));
  close(result.interval.upper, 2.5e-12 / (-2 * Math.log(0.975)));
});
test("reference integration: centered MLE and unbiased spread give the same confidence interval", () => {
  const csv = "time,x,y\n0,0,0\n1,1,2\n2,4,1\n3,2,2";
  const centered = calculate(csv, { estimator: "drift-centered" });
  const mle = calculate(csv, { estimator: "maximum-likelihood-centered" });
  close(mle.estimate.dHat, (centered.estimate.dHat * 2) / 3);
  close(mle.interval.lower, centered.interval.lower);
  close(mle.interval.upper, centered.interval.upper);
});
test("reference integration: doubling independent pixel calibration quadruples diffusion and interval endpoints", () => {
  const csv = "time,x,y\n0,0,0\n1,1,2\n2,4,1";
  const first = calculate(csv, {}, { time: "s", position: "px", micrometresPerPixel: 0.1 });
  const second = calculate(csv, {}, { time: "s", position: "px", micrometresPerPixel: 0.2 });
  close(second.estimate.dHat, first.estimate.dHat * 4);
  close(second.interval.lower, first.interval.lower * 4);
  close(second.interval.upper, first.interval.upper * 4);
});
test("reference integration: nonzero exposure is outside the admitted model", () => {
  const result = calculate("time,x\n0,0\n1,1\n2,3", { exposureTime: 0.01 });
  assert.equal(result.kind, "unavailable");
  assert.equal(result.estimate, null);
  assert.equal(result.interval, null);
});
test("reference integration: unknown noise is not an ideal recording", () => {
  const result = calculate("time,x\n0,0\n1,1\n2,3", { localizationStd: null });
  assert.equal(result.kind, "unavailable");
  assert.equal(result.interval, null);
});
test("reference integration: stationary data are not infinite molecular evidence", () => {
  const result = calculate("time,x\n0,2\n1,2\n2,2", {
    independentRadius: { T: 293.15, eta: 0.001, a: 0.5e-6 },
  });
  assert.equal(result.estimate.dHat, 0);
  assert.equal(result.interval, null);
  assert.equal(result.molecular, null);
});
test("reference integration: modern SI inverse preserves its consistency-check meaning", () => {
  const result = calculate("time,x,y\n0,0,0\n1,1,2\n2,4,1", {
    independentRadius: { T: 293.15, eta: 0.001, a: 0.5e-6 },
  });
  assert.equal(result.molecular.semanticKind, "consistency-check");
  assert.equal(result.molecular.constantSetId, "modern-si-2019");
  assert.ok(result.molecular.interval.lower < result.molecular.estimate);
  assert.ok(result.molecular.interval.upper > result.molecular.estimate);
  assert.ok(result.molecular.estimatedBoltzmannConstant > 0);
  assert.match(result.molecularMessage, /not an independent count/);
});
