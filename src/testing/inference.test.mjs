import assert from "node:assert/strict";
import test from "node:test";
import { createDeclaredConstantSet, getConstantSet } from "../physics/reference/constants.ts";
import {
  chiSquareInterval,
  combinedMolecularNumberInterval,
  driftCenteredEstimator,
  estimatorInterval,
  INFERENCE_SENSITIVITIES,
  identifiabilityFamily,
  independentIncrementEstimator,
  independentModelAdmission,
  inverseBias,
  invertToMolecularNumber,
  mleEstimator,
} from "../physics/reference/inference.ts";

const ok = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};
const close = (a, b, t = 1e-10) =>
  assert.ok(Math.abs(a - b) <= t * Math.max(Math.abs(b), 1e-100), `${a} != ${b}`);
const si = getConstantSet("modern-si-2019");
const conditions = { T: 293.15, eta: 0.001, a: 0.5e-6, radiusProvenance: "independently-declared" };
const inverse = (more = {}) =>
  invertToMolecularNumber(
    {
      ...conditions,
      dHat: 0.42944e-12,
      interval: ok(chiSquareInterval({ dHat: 0.42944e-12, q: 100, alpha: 0.05 })),
      synthetic: false,
      ...more,
    },
    si,
  );

test("known-zero and centered estimators use different degrees of freedom and preserve observations", () => {
  const x = new Float64Array([1, 2, 3, 4]),
    copy = x.slice();
  const zero = ok(independentIncrementEstimator(x, 1, { d: 2 })),
    center = ok(driftCenteredEstimator(x, 1, { d: 2 })),
    mle = ok(mleEstimator(x, 1, { d: 2 }));
  assert.deepEqual([zero.dHat, zero.q, zero.sumSquares], [3.75, 4, 30]);
  close(center.dHat, 1);
  assert.equal(center.q, 2);
  close(mle.dHat, 0.5);
  close(mle.biasFactor, 0.5);
  assert.deepEqual([...center.drift], [2, 3]);
  assert.deepEqual(x, copy);
  const a = ok(estimatorInterval(center, 0.05)),
    b = ok(estimatorInterval(mle, 0.05));
  assert.equal(a.lower, b.lower);
  assert.equal(a.upper, b.upper);
  assert.notEqual(a.estimatorId, b.estimatorId);
});
test("absence of observations and a one-increment drift fit are underdetermined, not zeros", () => {
  assert.equal(
    independentIncrementEstimator(new Float64Array(), 1, { d: 1 }).status,
    "underdetermined",
  );
  assert.equal(
    driftCenteredEstimator(new Float64Array([1, 2]), 1, { d: 2 }).status,
    "underdetermined",
  );
  assert.equal(mleEstimator(new Float64Array([1]), 1, { d: 1 }).status, "underdetermined");
  for (const [x, dt, d] of [
    [new Float64Array([NaN]), 1, 1],
    [new Float64Array([1]), 0, 1],
    [new Float64Array([1]), 1, 2],
    [new Float64Array([1e300]), 1, 1],
    [new Float64Array([1e-300]), 1, 1],
  ])
    assert.equal(independentIncrementEstimator(x, dt, { d }).kind, "refused");
});
test("chi-square intervals match independent SciPy 1.17.0 fixtures including fractional q", () => {
  // scipy.stats.chi2.ppf, independently evaluated; not values from this owner.
  const fixtures = [
    [100, 0.05, 74.22192747492373, 129.5611971858366],
    [100, 0.025, 71.01409859371837, 134.34165064616502],
    [1, 0.05, 0.0009820691171752555, 5.023886187314888],
    [2.5, 0.05, 0.11862294210006345, 8.392295266912964],
  ];
  for (const [q, alpha, lo, hi] of fixtures) {
    const ci = ok(chiSquareInterval({ dHat: 0.42944e-12, q, alpha }));
    close(ci.lower, (0.42944e-12 * q) / hi, 2e-11);
    close(ci.upper, (0.42944e-12 * q) / lo, 2e-11);
    assert.equal(ci.coverageKind, "exact");
  }
  const ci = ok(chiSquareInterval({ dHat: 0.42944e-12, q: 100, alpha: 0.05 }));
  close(ci.lower, 0.3314573e-12, 2e-7);
  close(ci.upper, 0.5785891e-12, 2e-7);
  const wide = ok(chiSquareInterval({ dHat: 1, q: 20, alpha: 0.01 })),
    narrow = ok(chiSquareInterval({ dHat: 1, q: 20, alpha: 0.1 }));
  assert.ok(wide.lower < narrow.lower && wide.upper > narrow.upper);
});
test("molecular inversion reverses interval endpoints and modern SI is only a consistency check", () => {
  const r = ok(inverse());
  close(r.estimate, 6.0221346536491352128468028878143274e23, 1e-10);
  close(r.interval.lower, 4.46974e23, 2e-6);
  close(r.interval.upper, 7.80235e23, 2e-6);
  assert.equal(r.semanticKind, "consistency-check");
  close(r.consistencyRatio, r.estimate / 6.02214076e23);
  assert.ok(r.estimatedBoltzmannConstant > 0);
  const doubled = ok(inverse({ a: 1e-6 }));
  close(doubled.estimate, r.estimate / 2);
  assert.ok(r.interval.upper - r.estimate > r.estimate - r.interval.lower);
  assert.equal(ok(inverse({ synthetic: true })).semanticKind, "synthetic-recovery");
  assert.equal(inverse({ dHat: 0 }).status, "underdetermined");
  assert.equal(
    inverse({ radiusProvenance: "same-displacements" }).refusal.code,
    "circular-radius-from-displacement",
  );
});
test("inverse bias distinguishes centered MLE normalization and non-existent moments", () => {
  close(ok(inverseBias(10)).meanFactor, 1.25);
  close(ok(inverseBias(40)).meanFactor, 40 / 38);
  close(ok(inverseBias(8, 10)).meanFactor, 10 / 6);
  assert.equal(inverseBias(2).status, "not-applicable");
  assert.equal(ok(inverseBias(3)).varianceFactor, null);
  close(ok(inverseBias(10)).varianceFactor, 200 / (64 * 6));
});
test("Bonferroni interval matches the radius fixture and never invents missing input coverage", () => {
  const estimate = {
    dHat: 0.42944e-12,
    unbiasedDHat: 0.42944e-12,
    q: 100,
    M: 50,
    d: 2,
    normalization: 100,
    estimatorId: "independent-increment-known-zero-drift",
  };
  const args = {
    ...conditions,
    estimate,
    alphaD: 0.025,
    inputs: { a: { lower: 0.45e-6, upper: 0.55e-6, coverage: 0.975 } },
    synthetic: false,
  };
  const ci = ok(combinedMolecularNumberInterval(args, si));
  close(ci.lower, 3.88779e23, 2e-6);
  close(ci.upper, 8.98915e23, 2e-6);
  close(ci.coverage, 0.95);
  assert.equal(ci.coverageKind, "conservative");
  assert.equal(
    combinedMolecularNumberInterval(
      { ...args, inputs: { a: { lower: 0.45e-6, upper: 0.55e-6 } } },
      si,
    ).status,
    "not-applicable",
  );
  assert.equal(
    combinedMolecularNumberInterval({ ...args, alphaD: 0.99, inputs: args.inputs }, si).status,
    "not-applicable",
  );
  assert.equal(
    combinedMolecularNumberInterval(
      { ...args, inputs: { a: { lower: 0, upper: 0.55e-6, coverage: 0.975 } } },
      si,
    ).kind,
    "refused",
  );
});
test("identifiability is a family of radius-number pairs and publishes all algebraic sensitivities", () => {
  const f = ok(
    identifiabilityFamily(
      { D: 0.42944e-12, T: 293.15, eta: 0.001, radiusRange: [0.25e-6, 1e-6], synthetic: true },
      si,
    ),
  );
  for (let i = 0; i < 41; i++) close(f.radii[i] * f.numbers[i], f.product);
  close(f.numbers[0] / f.numbers[40], 4);
  assert.deepEqual(INFERENCE_SENSITIVITIES, {
    molarGasConstant: 1,
    temperature: 1,
    viscosity: -1,
    particleRadius: -1,
    spatialCalibration: -2,
  });
});
test("a declared scenario cannot impersonate independent observational evidence", () => {
  const set = createDeclaredConstantSet({
    id: "scenario-inference-test",
    era: 2026,
    provenance: "Instructional choice, not a measurement.",
    precisionNote: "Declared input.",
    gasConstantProvenance: "not-applicable",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: 8.31,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "theoretical-estimate",
        provenance: "Instructional choice.",
        dependsOn: ["scenario-input"],
      },
    ],
  });
  const args = {
    ...conditions,
    dHat: 1e-12,
    interval: ok(chiSquareInterval({ dHat: 1e-12, q: 20, alpha: 0.05 })),
    synthetic: false,
  };
  assert.equal(invertToMolecularNumber(args, set).status, "outside-domain");
  assert.equal(
    ok(invertToMolecularNumber({ ...args, synthetic: true }, set)).semanticKind,
    "synthetic-recovery",
  );
});
test("the independent interval fails closed for noise, blur, overlap, irregular timing and censoring", () => {
  const rule = {
    equalSpacing: true,
    nonOverlapping: true,
    localizationStd: 0,
    exposureTime: 0,
    censored: false,
  };
  assert.equal(ok(independentModelAdmission(rule)), true);
  for (const patch of [
    { equalSpacing: false },
    { nonOverlapping: false },
    { localizationStd: 0.1 },
    { exposureTime: 0.1 },
    { censored: true },
  ])
    assert.equal(independentModelAdmission({ ...rule, ...patch }).status, "outside-domain");
  const all = independentModelAdmission({
    equalSpacing: false,
    nonOverlapping: false,
    localizationStd: 0.1,
    exposureTime: 0.1,
    censored: true,
  });
  for (const word of ["irregular", "overlapping", "localization", "blur", "censored"])
    assert.match(all.reason, new RegExp(word));
});
