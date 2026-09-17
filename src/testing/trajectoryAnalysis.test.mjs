// Orchestration tests use an instrumented owner, not an alternate physics implementation.
// Numerical owner integration has its own test file and requires the complete repository.
import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeTrajectory,
  trajectoryAnalysisJson,
} from "../experiments/bm07/trajectoryAnalysis.ts";
import { parseTrajectoryCsv } from "../experiments/bm07/trajectoryCsv.ts";

const trajectory = parseTrajectoryCsv("time,x,y\n0,0,0\n1,1,2\n2,3,1", {
  time: "s",
  position: "um",
});
const assumptions = {
  estimator: "drift-centered",
  coverage: 0.95,
  independentIsotropic: true,
  commonDriftAndDiffusion: false,
  localizationStd: 0,
  exposureTime: 0,
  censored: false,
  independentRadius: null,
};
function owner() {
  const calls = [];
  const estimate = {
    dHat: 1e-12,
    unbiasedDHat: 2e-12,
    M: 2,
    d: 2,
    q: 2,
    sumSquares: 8e-12,
    normalization: 4,
    biasFactor: 0.5,
    drift: new Float64Array([1e-6, -1e-6]),
    estimatorId: "maximum-likelihood-centered",
  };
  const interval = {
    lower: 1e-13,
    upper: 1e-11,
    coverage: 0.95,
    q: 2,
    uncertaintyKind: "statistical-interval",
    coverageKind: "exact",
    estimatorId: estimate.estimatorId,
  };
  const reference = {
    independentModelAdmission(rule) {
      calls.push(["admission", rule]);
      return { kind: "accepted", data: true };
    },
    estimateIncrements(...args) {
      calls.push(["estimate", ...args]);
      return { kind: "accepted", data: estimate };
    },
    estimatorInterval(...args) {
      calls.push(["interval", ...args]);
      return { kind: "accepted", data: interval };
    },
    invertToMolecularNumber(...args) {
      calls.push(["invert", ...args]);
      return {
        kind: "accepted",
        data: {
          estimate: 6e23,
          interval,
          constantSetId: "modern-si-2019",
          semanticKind: "consistency-check",
          consistencyRatio: 0.996,
          estimatedBoltzmannConstant: 1.3e-23,
        },
      };
    },
  };
  let constants = 0;
  const constantSet = () => {
    constants++;
    return { id: "modern-si-2019" };
  };
  return {
    calls,
    estimate,
    interval,
    reference,
    constantSet,
    get constants() {
      return constants;
    },
  };
}
const run = (overrides = {}, data = trajectory, context = owner()) => ({
  result: analyzeTrajectory(
    data,
    { ...assumptions, ...overrides },
    context.reference,
    context.constantSet,
  ),
  context,
});
test("admission precedes estimation; SI increments and dimensionality reach the existing owner", () => {
  const { result, context } = run();
  assert.deepEqual(
    context.calls.map((c) => c[0]),
    ["admission", "estimate", "interval"],
  );
  assert.deepEqual(Array.from(context.calls[1][1]), trajectory.increments);
  assert.equal(context.calls[1][2], 1);
  assert.equal(context.calls[1][3], 2);
  assert.equal(result.estimate, context.estimate);
  assert.equal(result.interval, context.interval);
  assert.equal(result.sourceKind, "user-supplied-not-independently-verified");
});
test("the estimator interval owner receives the full estimate, preserving MLE's unbiased interval scale", () => {
  const { context } = run({ estimator: "maximum-likelihood-centered" });
  assert.equal(context.calls[2][1], context.estimate);
  assert.ok(Math.abs(context.calls[2][2] - 0.05) < 1e-14);
});
for (const key of ["localizationStd", "exposureTime", "censored"])
  test(`unknown ${key} is not replaced with zero`, () => {
    const { result, context } = run({ [key]: null });
    assert.equal(result.kind, "unavailable");
    assert.equal(context.calls.length, 0);
    assert.equal(result.interval, null);
  });
test("independent/isotropic assumptions need an explicit declaration", () => {
  const { result, context } = run({ independentIsotropic: false });
  assert.equal(result.estimate, null);
  assert.equal(context.calls.length, 0);
});
test("pooled tracks require a declared shared drift and diffusion", () => {
  const data = parseTrajectoryCsv("track,time,x\na,0,0\na,1,1\nb,0,3\nb,1,5", {
    time: "s",
    position: "um",
  });
  const { result, context } = run({}, data);
  assert.equal(result.kind, "unavailable");
  assert.equal(context.calls.length, 0);
  assert.equal(run({ commonDriftAndDiffusion: true }, data).result.kind, "analyzed");
});
test("irregular timing never reaches the equal-spacing estimator", () => {
  const data = parseTrajectoryCsv("time,x\n0,0\n1,1\n3,3", { time: "s", position: "um" });
  const { result, context } = run({}, data);
  assert.equal(result.kind, "unavailable");
  assert.equal(context.calls.length, 0);
});
test("noise, exposure and censoring are passed to the admission owner unchanged", () => {
  const context = owner();
  context.reference.independentModelAdmission = (rule) => {
    context.calls.push(rule);
    return { kind: "no-value", status: "outside-domain", reason: "Camera model required" };
  };
  const { result } = run(
    { localizationStd: 4e-9, exposureTime: 0.01, censored: true },
    trajectory,
    context,
  );
  assert.deepEqual(context.calls, [
    {
      equalSpacing: true,
      nonOverlapping: true,
      localizationStd: 4e-9,
      exposureTime: 0.01,
      censored: true,
    },
  ]);
  assert.equal(result.message, "Camera model required");
  assert.equal(result.estimate, null);
});
test("owner numerical refusals are retained, not replaced by fake values", () => {
  const context = owner();
  context.reference.estimateIncrements = () => ({
    kind: "refused",
    refusal: { message: "Scale exceeds binary64" },
  });
  const { result } = run({}, trajectory, context);
  assert.equal(result.estimate, null);
  assert.equal(result.message, "Scale exceeds binary64");
});
test("an underdetermined drift fit is not a successful analysis", () => {
  const context = owner();
  context.reference.estimateIncrements = () => ({
    kind: "no-value",
    status: "underdetermined",
    reason: "A second increment is needed",
  });
  assert.equal(run({}, trajectory, context).result.kind, "unavailable");
});
test("a zero diffusion estimate does not produce a zero-width interval or infinite inverse", () => {
  const context = owner();
  context.estimate.dHat = 0;
  context.estimate.unbiasedDHat = 0;
  const { result } = run(
    { independentRadius: { T: 293, eta: 0.001, a: 5e-7 } },
    trajectory,
    context,
  );
  assert.equal(result.interval, null);
  assert.equal(result.molecular, null);
  assert.deepEqual(
    context.calls.map((c) => c[0]),
    ["admission", "estimate"],
  );
});
test("a refused interval keeps the point estimate but never supplies an inverse", () => {
  const context = owner();
  context.reference.estimatorInterval = () => ({
    kind: "refused",
    refusal: { message: "Interval outside numeric range" },
  });
  const { result } = run({}, trajectory, context);
  assert.equal(result.estimate, context.estimate);
  assert.equal(result.interval, null);
});
test("unknown radius still allows diffusion and does not read constants", () => {
  const { result, context } = run();
  assert.ok(result.interval);
  assert.equal(result.molecular, null);
  assert.equal(context.constants, 0);
  assert.match(result.molecularMessage, /does not separate/);
});
test("observational inversion is explicitly nonsynthetic and independently calibrated", () => {
  const { result, context } = run({ independentRadius: { T: 293.15, eta: 0.001, a: 0.5e-6 } });
  const inverted = context.calls.find((c) => c[0] === "invert");
  assert.equal(inverted[1].synthetic, false);
  assert.equal(inverted[1].radiusProvenance, "independently-declared");
  assert.equal(inverted[1].dHat, context.estimate.dHat);
  assert.equal(inverted[1].interval, context.interval);
  assert.equal(inverted[2].id, "modern-si-2019");
  assert.equal(result.molecular.semanticKind, "consistency-check");
  assert.match(result.molecularMessage, /not an independent count/);
});
test("an owner constant-semantic mismatch cannot change the result's evidential role", () => {
  const context = owner();
  context.reference.invertToMolecularNumber = () => ({
    kind: "accepted",
    data: { semanticKind: "synthetic-recovery" },
  });
  const { result } = run(
    { independentRadius: { T: 293, eta: 0.001, a: 5e-7 } },
    trajectory,
    context,
  );
  assert.equal(result.molecular, null);
  assert.match(result.molecularMessage, /no molecular result/);
});
test("radius refusal does not discard admitted diffusion results", () => {
  const context = owner();
  context.reference.invertToMolecularNumber = () => ({
    kind: "refused",
    refusal: { message: "Radius must be positive" },
  });
  const { result } = run({ independentRadius: { T: 293, eta: 0.001, a: -1 } }, trajectory, context);
  assert.equal(result.interval, context.interval);
  assert.equal(result.molecular, null);
  assert.match(result.molecularMessage, /Radius/);
});
for (const coverage of [NaN, 0, 0.49, 1, Infinity])
  test(`invalid coverage ${coverage} cannot start numerical work`, () => {
    const context = owner();
    assert.throws(() => run({ coverage }, trajectory, context), /coverage/);
    assert.equal(context.calls.length, 0);
  });
test("accepted assumptions are copied and frozen; later edits cannot relabel results", () => {
  const input = { ...assumptions, independentRadius: { T: 293, eta: 0.001, a: 5e-7 } },
    context = owner();
  const result = analyzeTrajectory(trajectory, input, context.reference, context.constantSet);
  input.coverage = 0.9;
  input.independentRadius.a = 1;
  assert.equal(result.assumptions.coverage, 0.95);
  assert.equal(result.assumptions.independentRadius.a, 5e-7);
  assert.equal(Object.isFrozen(result.assumptions.independentRadius), true);
});
test("analysis export includes SI data, accepted assumptions, null outcomes and provenance", () => {
  const { result } = run();
  const report = JSON.parse(trajectoryAnalysisJson(result));
  assert.equal(report.schema, "annus-mirabilis-trajectory-analysis/v1");
  assert.equal(report.result.molecular, null);
  assert.deepEqual(report.result.estimate.drift, [1e-6, -1e-6]);
  assert.equal(report.assumptions.coverage, 0.95);
  assert.equal(report.trajectory.points.length, 3);
  assert.equal(report.siUnits.diffusion, "m2/s");
  assert.match(report.sourceVerification, /Not independently verified/);
});
