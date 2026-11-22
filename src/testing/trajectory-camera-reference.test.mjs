/** Full-repository tests: exercise the real CSV reader and numerical owner.
 * These are separate from the dependency-injected orchestration tests. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { cameraTrajectoryAnalysisJson } from "../experiments/bm07/trajectoryCamera.ts";
import { parseTrajectoryCsv } from "../experiments/bm07/trajectoryCsv.ts";
import { analyzeImportedCameraTrajectory } from "../experiments/bm07/trajectoryHost.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { invertToMolecularNumber } from "../physics/reference/inference.ts";
import { withinTolerance } from "../units/tolerance.ts";

const assumptions = {
  estimator: "drift-centered",
  coverage: 0.95,
  independentIsotropic: false,
  commonDriftAndDiffusion: true,
  localizationStd: 1,
  exposureTime: 0.3,
  censored: false,
  independentRadius: null,
};
const single = "track,time,x\nA,0,0\nA,1,2\nA,2,999\nA,3,1003\nA,4,0\nA,5,6\n";
const multiple =
  "track,time,x\nA,0,0\nB,0,1000\nC,0,0\nA,1,2\nB,1,1004\nC,1,6\nA,2,999\nB,2,9999\nC,2,99999\n";
const read = (text, position = "m") => parseTrajectoryCsv(text, { time: "s", position });
const near = (actual, expected, absolute = 1e-12) =>
  assert.ok(
    withinTolerance(actual, expected, { absolute, relative: 1e-10 }).ok,
    `${actual} did not agree with independently calculated ${expected}`,
  );

test("real owner fits disjoint displacements [2,4,6] and corrects camera variance", () => {
  const result = analyzeImportedCameraTrajectory(read(single), assumptions, true);
  assert.equal(result.kind, "analyzed");
  assert.equal(result.camera.pairs, 3);
  assert.equal(result.camera.q, 2);
  // Unbiased variance is 4; subtract 2*sigma^2 and divide by 2*(dt-Te/3).
  near(result.camera.estimate, (4 - 2) / 1.8);
  assert.equal(result.camera.lowerClipped, true);
  assert.equal(result.camera.interval.lower, 0);
  // For two degrees of freedom the chi-square quantile has a closed form.
  const varianceUpper = 8 / (-2 * Math.log(0.975));
  near(result.camera.interval.upper, (varianceUpper - 2) / 1.8);
  assert.equal(result.camera.coverageKind, "exact");
  assert.equal(result.molecular, null);
});

test("real imported interleaved tracks never include artificial inter-particle jumps", () => {
  const expected = analyzeImportedCameraTrajectory(read(single), assumptions, true);
  const actual = analyzeImportedCameraTrajectory(read(multiple), assumptions, true);
  assert.equal(actual.kind, "analyzed");
  assert.equal(actual.camera.pairs, 3);
  assert.equal(actual.pairing.unpairedRows.length, 3);
  assert.equal(actual.trajectory.points.length, 9);
  near(actual.camera.estimate, expected.camera.estimate);
  near(actual.camera.interval.upper, expected.camera.interval.upper);
});

test("real noise correction retains an empty confidence set instead of inventing a bound", () => {
  const result = analyzeImportedCameraTrajectory(
    read(single),
    { ...assumptions, localizationStd: 10 },
    true,
  );
  assert.equal(result.kind, "analyzed");
  assert.equal(result.camera.empty, true);
  assert.equal(result.camera.interval, null);
  near(result.camera.estimate, (4 - 200) / 1.8);
  assert.match(result.message, /confidence set is empty/);
});

test("micrometre import and metre-based camera parameters use the same SI owner", () => {
  const result = analyzeImportedCameraTrajectory(
    read(single, "um"),
    { ...assumptions, localizationStd: 1e-6 },
    true,
  );
  assert.equal(result.kind, "analyzed");
  near(result.camera.estimate, ((4 - 2) / 1.8) * 1e-12, 1e-24);
  assert.equal(result.camera.q, 2);
});

test("real camera data with a positive confidence set yields the owner's modern-SI inverse", () => {
  const radius = { T: 293.15, eta: 0.001, a: 0.5e-6 };
  const result = analyzeImportedCameraTrajectory(
    read(single, "um"),
    { ...assumptions, localizationStd: 1e-7, independentRadius: radius },
    true,
  );
  assert.equal(result.kind, "analyzed");
  assert.ok(result.camera.interval.lower > 0);
  near(result.camera.estimate, ((4 - 0.02) / 1.8) * 1e-12, 1e-24);
  const expected = invertToMolecularNumber(
    {
      ...radius,
      radiusProvenance: "independently-declared",
      dHat: result.camera.estimate,
      interval: result.camera.interval,
      synthetic: false,
    },
    getConstantSet("modern-si-2019"),
  );
  assert.equal(expected.kind, "accepted");
  assert.deepEqual(result.molecular, expected.data);
  assert.equal(result.molecular.semanticKind, "consistency-check");
  assert.equal(result.molecular.constantSetId, "modern-si-2019");
  assert.ok(result.molecular.interval.lower < result.molecular.estimate);
  assert.ok(result.molecular.estimate < result.molecular.interval.upper);
  assert.ok(result.molecular.estimatedBoltzmannConstant > 0);
  assert.match(result.molecularMessage, /not an independent count/);
  const exported = JSON.parse(cameraTrajectoryAnalysisJson(result));
  assert.deepEqual(exported.molecular, result.molecular);
  assert.deepEqual(exported.assumptions.independentRadius, radius);
  assert.deepEqual(exported.trajectory, result.trajectory);
});

test("an independent radius cannot rescue a real camera set reaching zero or an empty set", () => {
  for (const localizationStd of [1e-6, 10e-6]) {
    const result = analyzeImportedCameraTrajectory(
      read(single, "um"),
      {
        ...assumptions,
        localizationStd,
        independentRadius: { T: 293.15, eta: 0.001, a: 0.5e-6 },
      },
      true,
    );
    assert.equal(result.kind, "analyzed");
    assert.equal(result.molecular, null);
    assert.ok(result.camera.empty || result.camera.interval.lower === 0);
    assert.match(result.molecularMessage, /no nonempty|no finite upper bound/);
    assert.equal(JSON.parse(cameraTrajectoryAnalysisJson(result)).molecular, null);
  }
});

test("a real positive camera estimate does not fill in missing independent physical inputs", () => {
  for (const independentRadius of [null, { T: 293.15, a: 0.5e-6 }]) {
    const result = analyzeImportedCameraTrajectory(
      read(single, "um"),
      { ...assumptions, localizationStd: 1e-7, independentRadius },
      true,
    );
    assert.ok(result.camera.interval.lower > 0);
    assert.equal(result.molecular, null);
    assert.match(result.molecularMessage, /independent|requirements/);
  }
});
