import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_TRAJECTORY_DRAFT as empty,
  readTrajectoryDraft as read,
} from "../experiments/bm07/trajectoryDraft.ts";
const declared = { ...empty, timeUnit: "s", positionUnit: "um" };
test("units require an explicit choice", () => {
  assert.throws(() => read(empty), /Choose both/);
});
test("unknown noise and exposure remain null and model boxes start unconfirmed", () => {
  const { assumptions: a } = read(declared);
  assert.equal(a.localizationStd, null);
  assert.equal(a.exposureTime, null);
  assert.equal(a.censored, null);
  assert.equal(a.independentIsotropic, false);
  assert.equal(a.independentRadius, null);
});
test("explicit zero is distinct from blank and finite exposure converts to seconds", () => {
  const { assumptions: a } = read({
    ...declared,
    localizationNanometres: "0",
    exposureMilliseconds: "5",
    censored: "no",
  });
  assert.equal(a.localizationStd, 0);
  assert.equal(a.exposureTime, 0.005);
  assert.equal(a.censored, false);
});
test("physical declarations convert to SI rather than mixing mPa and Pa", () => {
  const { assumptions: a } = read({
    ...declared,
    radiusIndependent: true,
    temperatureKelvin: "293.15",
    viscosityMillipascalSeconds: "1",
    radiusMicrometres: ".5",
  });
  assert.deepEqual(a.independentRadius, { T: 293.15, eta: 0.001, a: 0.5e-6 });
});
test("radius declaration cannot fill in invented defaults", () => {
  assert.throws(() => read({ ...declared, radiusIndependent: true }), /Temperature/);
});
test("unselected optional radius values cannot affect a result", () => {
  assert.equal(
    read({ ...declared, radiusIndependent: false, radiusMicrometres: "garbage" }).assumptions
      .independentRadius,
    null,
  );
});
test("pixel positions need an explicit positive calibration", () => {
  assert.throws(() => read({ ...declared, positionUnit: "px" }), /calibration/);
  assert.equal(
    read({ ...declared, positionUnit: "px", micrometresPerPixel: ".3" }).units.micrometresPerPixel,
    0.3,
  );
});
for (const value of ["-1", "NaN", "Infinity", "0x10", "1e-999", "=1", "1e309"])
  test(`reject malformed measurement ${value}`, () => {
    assert.throws(() => read({ ...declared, localizationNanometres: value }));
  });
test("zero with a nonzero exponent is still explicitly zero", () => {
  assert.equal(
    read({ ...declared, localizationNanometres: "0e-999" }).assumptions.localizationStd,
    0,
  );
});
for (const value of ["49", "100", "0"])
  test(`coverage ${value} is outside the UI bound`, () => {
    assert.throws(() => read({ ...declared, coveragePercent: value }), /coverage|Coverage/);
  });
test("invalid enum values are rejected rather than coerced", () => {
  assert.throws(
    () => read({ ...declared, estimator: "new-magic-estimator" }),
    /registered estimator/,
  );
  assert.throws(() => read({ ...declared, censored: "possibly" }), /selection status/);
});
test("the documented 50% and 99.9% boundaries survive decimal conversion", () => {
  assert.equal(read({ ...declared, coveragePercent: "50" }).assumptions.coverage, 0.5);
  assert.equal(read({ ...declared, coveragePercent: "95" }).assumptions.coverage, 0.95);
  assert.equal(read({ ...declared, coveragePercent: "99.9" }).assumptions.coverage, 0.999);
  assert.throws(() => read({ ...declared, coveragePercent: "99.90001" }), /coverage/);
});
