import assert from "node:assert/strict";
import test from "node:test";
import { withinTolerance } from "../../../units/tolerance.ts";
import { estimateIncrements, estimatorInterval } from "../inference.ts";
import {
  cameraCompatibleFamily,
  conditionalMolecularNumberInterval,
  diffusionCompatibleBand,
  twoIntervalCameraEstimate,
} from "./identifiability.ts";
import { cameraMoments } from "./observation.ts";
import { INFERENCE_CONSTANTS } from "./synthetic.ts";

const take = (value) => {
  assert.equal(value.kind, "accepted", JSON.stringify(value));
  return value.data;
};
const near = (a, b) =>
  assert.ok(withinTolerance(a, b, { relative: 1e-12, absolute: 1e-30 }).ok, `${a} != ${b}`);
const estimate = take(
  estimateIncrements(
    Float64Array.from([1, -1, 2, -2, 3, -3], (x) => x * 1e-6),
    1,
    1,
    "independent-increment-known-zero-drift",
  ),
);
const radius = {
  value: 0.5e-6,
  interval: { lower: 0.4e-6, upper: 0.6e-6, coverage: 0.975 },
  provenance: "Independent synthetic calibration",
};
const base = {
  estimate,
  T: 293.15,
  eta: 0.001,
  alpha: 0.05,
  synthetic: true,
  radius,
  radiusProvenance: "independently-declared",
};

test("diffusion interval maps to a band at every compatible radius", () => {
  const band = take(
    diffusionCompatibleBand({ ...base, radiusRange: [0.1e-6, 2e-6] }, INFERENCE_CONSTANTS),
  );
  assert.equal(band.radii.length, 41);
  for (let i = 0; i < 41; i++) {
    near(band.radii[i] * band.numbers[i], band.product);
    assert.ok(band.lowerNumbers[i] < band.numbers[i]);
    assert.ok(band.upperNumbers[i] > band.numbers[i]);
    near(band.lowerNumbers[i] / band.numbers[i], estimate.dHat / band.interval.upper);
    near(band.upperNumbers[i] / band.numbers[i], estimate.dHat / band.interval.lower);
  }
});
test("no radius means underdetermined, not a conditional interval", () => {
  const result = conditionalMolecularNumberInterval({ ...base, radius: null }, INFERENCE_CONSTANTS);
  assert.equal(result.kind, "no-value");
  assert.equal(result.status, "underdetermined");
});
test("Bonferroni combines 97.5 percent margins into at least 95 percent coverage", () => {
  const result = take(conditionalMolecularNumberInterval(base, INFERENCE_CONSTANTS));
  const ci = take(estimatorInterval(estimate, 0.025));
  const C = (8.314471 * base.T) / (6 * Math.PI * base.eta);
  near(result.lower, C / (radius.interval.upper * ci.upper));
  near(result.upper, C / (radius.interval.lower * ci.lower));
  near(result.coverage, 0.95);
  assert.equal(result.coverageKind, "conservative");
});
test("uncertain temperature and viscosity receive their own error allocation", () => {
  const measurement = (value) => ({
    value,
    interval: { lower: value * 0.9, upper: value * 1.1, coverage: 0.99 },
    provenance: "Separate calibration",
  });
  const result = take(
    conditionalMolecularNumberInterval(
      {
        ...base,
        radius: measurement(radius.value),
        temperature: measurement(base.T),
        viscosity: measurement(base.eta),
      },
      INFERENCE_CONSTANTS,
    ),
  );
  near(result.coverage, 1 - (0.05 / 4 + 0.03));
  assert.equal(result.coverageKind, "conservative");
});
test("lower coverage cannot be relabeled to meet the target", () => {
  const result = conditionalMolecularNumberInterval(
    { ...base, radius: { ...radius, interval: { ...radius.interval, coverage: 0.95 } } },
    INFERENCE_CONSTANTS,
  );
  assert.equal(result.kind, "no-value");
  assert.equal(result.status, "not-applicable");
});
test("circular radius inference is refused by the existing owner", () => {
  const result = conditionalMolecularNumberInterval(
    { ...base, radiusProvenance: "same-displacements" },
    INFERENCE_CONSTANTS,
  );
  assert.equal(result.kind, "refused");
  assert.equal(result.refusal.code, "circular-radius-from-displacement");
});
test("invalid calibration, missing provenance and nonfinite inputs are refused", () => {
  for (const change of [
    { provenance: "" },
    { value: 0 },
    { interval: { lower: 1e-6, upper: 2e-6, coverage: 0.975 } },
    { interval: { lower: NaN, upper: 1e-6, coverage: 0.975 } },
  ]) {
    assert.equal(
      conditionalMolecularNumberInterval(
        { ...base, radius: { ...radius, ...change } },
        INFERENCE_CONSTANTS,
      ).kind,
      "refused",
    );
  }
  assert.equal(
    conditionalMolecularNumberInterval({ ...base, alpha: NaN }, INFERENCE_CONSTANTS).kind,
    "refused",
  );
});
test("one camera variance leaves many pairs, with distinguishable covariances", () => {
  for (const exposure of [0, 0.5, 1]) {
    const m = take(cameraMoments({ D: 0.4e-12, dt: 1, exposure, sigma: 0.2e-6, drift: 0, d: 1 }));
    const family = take(cameraCompatibleFamily({ variance: m.variance, dt: 1, exposure }));
    for (let i = 0; i < 41; i++) {
      const row = take(
        cameraMoments({
          D: family.diffusion[i],
          dt: 1,
          exposure,
          sigma: Math.sqrt(family.noiseVariance[i]),
          drift: 0,
          d: 1,
        }),
      );
      near(row.variance, m.variance);
      near(row.covariance, family.covariance[i]);
    }
    assert.notEqual(family.covariance[0], family.covariance[40]);
    assert.equal(family.noiseVariance[40], 0);
  }
});
test("two spacings recover both unknowns at zero, partial and full exposure", () => {
  for (const exposure of [0, 0.5, 1]) {
    const model = { D: 0.4e-12, exposure, sigma: 0.2e-6, drift: 0, d: 1 };
    const first = take(cameraMoments({ ...model, dt: 1 })),
      second = take(cameraMoments({ ...model, dt: 2 }));
    const result = take(
      twoIntervalCameraEstimate({
        firstVariance: first.variance,
        secondVariance: second.variance,
        firstDt: 1,
        secondDt: 2,
        exposure,
      }),
    );
    near(result.D, model.D);
    near(result.sigma2, model.sigma ** 2);
    assert.equal(result.physical, true);
  }
});
test("negative finite-sample estimates remain diagnostics rather than being clipped", () => {
  const result = take(
    twoIntervalCameraEstimate({
      firstVariance: 2,
      secondVariance: 1,
      firstDt: 1,
      secondDt: 2,
      exposure: 0,
    }),
  );
  assert.equal(result.D, -0.5);
  assert.equal(result.physical, false);
  const other = take(
    twoIntervalCameraEstimate({
      firstVariance: 1,
      secondVariance: 4,
      firstDt: 1,
      secondDt: 2,
      exposure: 0,
    }),
  );
  assert.ok(other.sigma2 < 0);
  assert.equal(other.physical, false);
});
test("invalid variance, spacing and exposure never generate a family or inverse", () => {
  for (const patch of [{ variance: 0 }, { dt: 0 }, { exposure: 2 }, { variance: Infinity }])
    assert.equal(
      cameraCompatibleFamily({ variance: 1, dt: 1, exposure: 0, ...patch }).kind,
      "refused",
    );
  for (const patch of [{ secondDt: 1 }, { exposure: 2 }, { secondVariance: NaN }])
    assert.equal(
      twoIntervalCameraEstimate({
        firstVariance: 1,
        secondVariance: 2,
        firstDt: 1,
        secondDt: 2,
        exposure: 0,
        ...patch,
      }).kind,
      "refused",
    );
});
