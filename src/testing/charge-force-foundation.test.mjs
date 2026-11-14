import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHARGE_FIELDS,
  chargeForces,
  chargeInputs,
  DEFAULT_CHARGE_SETTINGS,
  readChargeInputs,
} from "../foundations/chargeForces.ts";
import { ELEMENTARY_CHARGE, lorentzForce } from "../physics/reference/fields.ts";

const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });
const AXES = ["x", "y", "z"];

function accepted(overrides = {}) {
  const result = chargeForces({ ...DEFAULT_CHARGE_SETTINGS, ...overrides });
  assert.equal(result.kind, "accepted", JSON.stringify(result));
  return result.snapshot;
}

// Forces here are of order 1e-16 N. An absolute tolerance such as 1e-11 N would accept
// zero in place of every answer, so compare relative to the actual physical scale.
function close(actual, expected, scale = Math.max(Math.abs(expected), ELEMENTARY_CHARGE)) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-12 * scale,
    String(actual) + " differs from " + String(expected) + " at scale " + String(scale),
  );
}

function vector(actual, expected) {
  for (const axis of AXES) close(actual[axis], expected[axis]);
}

function dot(left, right) {
  return AXES.reduce((sum, axis) => sum + left[axis] * right[axis], 0);
}

describe("the charge foundation separates electric and magnetic forces", () => {
  it("converts the displayed inputs to SI and balances two nonzero forces", () => {
    const state = accepted();
    assert.equal(state.chargeC, ELEMENTARY_CHARGE);
    vector(state.velocityMps, { x: 1e6, y: 0, z: 0 });
    vector(state.electricFieldVpm, { x: 0, y: 1000, z: 0 });
    vector(state.magneticFieldT, { x: 0, y: 0, z: 0.001 });
    vector(state.electricForceN, { x: 0, y: 1.602176634e-16, z: 0 });
    vector(state.magneticForceN, { x: 0, y: -1.602176634e-16, z: 0 });
    vector(state.totalForceN, ZERO);
    assert.ok(state.electricMagnitudeN > 0);
    assert.ok(state.magneticMagnitudeN > 0);
    assert.equal(state.totalMagnitudeN, 0);
  });

  it("reversing the charge reverses each force rather than relabelling the picture", () => {
    const positive = accepted({ electricVpm: 500, direction: "y" });
    const negative = accepted({ electricVpm: 500, direction: "y", charge: "negative" });
    assert.equal(negative.chargeC, -ELEMENTARY_CHARGE);
    for (const name of ["electricForceN", "magneticForceN", "totalForceN"]) {
      for (const axis of AXES) close(negative[name][axis], -positive[name][axis]);
    }
    assert.deepEqual(negative.velocityMps, positive.velocityMps);
    assert.deepEqual(negative.electricFieldVpm, positive.electricFieldVpm);
    assert.deepEqual(negative.magneticFieldT, positive.magneticFieldT);
    close(negative.totalMagnitudeN, positive.totalMagnitudeN);
    assert.ok(positive.totalMagnitudeN > 0);
  });

  it("a stationary charge keeps its electric force and loses only the magnetic contribution", () => {
    const moving = accepted();
    const stationary = accepted({ speedKms: 0 });
    vector(stationary.velocityMps, ZERO);
    vector(stationary.electricForceN, moving.electricForceN);
    vector(stationary.magneticForceN, ZERO);
    vector(stationary.totalForceN, { x: 0, y: 1000 * ELEMENTARY_CHARGE, z: 0 });
    assert.ok(stationary.totalMagnitudeN > 0);

    const noFields = accepted({ electricVpm: 0, magneticMt: 0 });
    vector(noFields.electricForceN, ZERO);
    vector(noFields.magneticForceN, ZERO);
    vector(noFields.totalForceN, ZERO);
    assert.equal(noFields.totalMagnitudeN, 0);
  });

  it("the cross product has the correct handedness and no force along the motion", () => {
    const right = accepted({ electricVpm: 0, direction: "x" });
    const up = accepted({ electricVpm: 0, direction: "y" });
    const alongField = accepted({ electricVpm: 0, direction: "z" });
    vector(right.magneticForceN, { x: 0, y: -1000 * ELEMENTARY_CHARGE, z: 0 });
    vector(up.magneticForceN, { x: 1000 * ELEMENTARY_CHARGE, y: 0, z: 0 });
    vector(alongField.magneticForceN, ZERO);
    assert.equal(alongField.totalMagnitudeN, 0);
    for (const state of [right, up, alongField]) {
      assert.equal(dot(state.magneticForceN, state.velocityMps), 0);
      assert.equal(dot(state.magneticForceN, state.magneticFieldT), 0);
    }
    assert.ok(right.magneticMagnitudeN > 0);
    assert.ok(up.magneticMagnitudeN > 0);
    vector(accepted({ electricVpm: 0, magneticMt: -1 }).magneticForceN, {
      x: 0,
      y: 1000 * ELEMENTARY_CHARGE,
      z: 0,
    });

    // A 3-4-5 triangle in units of 500 e checks the resultant's norm independently.
    const perpendicular = accepted({
      electricVpm: 1500,
      magneticMt: 1,
      speedKms: 2000,
      direction: "y",
    });
    close(perpendicular.electricMagnitudeN, 1500 * ELEMENTARY_CHARGE);
    close(perpendicular.magneticMagnitudeN, 2000 * ELEMENTARY_CHARGE);
    close(perpendicular.totalMagnitudeN, 2500 * ELEMENTARY_CHARGE);
  });

  it("changing either side of the balance produces the expected signed residual", () => {
    const weakerElectric = accepted({ electricVpm: 500 });
    const strongerElectric = accepted({ electricVpm: 1500 });
    vector(weakerElectric.totalForceN, { x: 0, y: -500 * ELEMENTARY_CHARGE, z: 0 });
    vector(strongerElectric.totalForceN, { x: 0, y: 500 * ELEMENTARY_CHARGE, z: 0 });
    vector(accepted({ speedKms: 2000 }).totalForceN, {
      x: 0,
      y: -1000 * ELEMENTARY_CHARGE,
      z: 0,
    });
    vector(accepted({ magneticMt: -1 }).totalForceN, {
      x: 0,
      y: 2000 * ELEMENTARY_CHARGE,
      z: 0,
    });
    assert.ok(weakerElectric.totalMagnitudeN > 0);
    close(strongerElectric.totalMagnitudeN, weakerElectric.totalMagnitudeN);
    vector(accepted({ charge: "negative" }).totalForceN, ZERO);
  });

  it("uses the registered owner for the components and the combined force", () => {
    for (const direction of AXES) {
      const state = accepted({
        electricVpm: -325,
        magneticMt: -0.75,
        speedKms: 812,
        direction,
        charge: "negative",
      });
      assert.deepEqual(
        state.electricForceN,
        lorentzForce(state.chargeC, state.electricFieldVpm, ZERO, state.velocityMps),
      );
      assert.deepEqual(
        state.magneticForceN,
        lorentzForce(state.chargeC, ZERO, state.magneticFieldT, state.velocityMps),
      );
      assert.deepEqual(
        state.totalForceN,
        lorentzForce(
          state.chargeC,
          state.electricFieldVpm,
          state.magneticFieldT,
          state.velocityMps,
        ),
      );
      for (const axis of AXES) {
        close(
          state.totalForceN[axis],
          state.electricForceN[axis] + state.magneticForceN[axis],
          Math.max(state.electricMagnitudeN, state.magneticMagnitudeN, ELEMENTARY_CHARGE),
        );
      }
    }
  });
});

describe("charge input admission preserves a well-defined scientific state", () => {
  it("refuses empty, nonfinite and out-of-range numbers without clamping or turning blanks into zero", () => {
    assert.ok(CHARGE_FIELDS.length > 0);
    for (const field of CHARGE_FIELDS) {
      for (const value of [
        "",
        " ",
        "NaN",
        "Infinity",
        "1e309",
        String(field.min - 1),
        String(field.max + 1),
      ]) {
        const result = readChargeInputs({
          ...chargeInputs(DEFAULT_CHARGE_SETTINGS),
          [field.key]: value,
        });
        assert.equal(result.kind, "refused", field.key + " " + value);
        assert.equal(result.field, field.key);
        assert.ok(result.reason.length > 0);
      }
      for (const value of [NaN, Infinity, -Infinity, field.min - 1, field.max + 1]) {
        const result = chargeForces({ ...DEFAULT_CHARGE_SETTINGS, [field.key]: value });
        assert.equal(result.kind, "refused");
        assert.equal(result.field, field.key);
      }
      for (const value of [field.min, field.max]) {
        const settings = { ...DEFAULT_CHARGE_SETTINGS, [field.key]: value };
        assert.equal(readChargeInputs(chargeInputs(settings)).kind, "accepted");
        assert.equal(chargeForces(settings).kind, "accepted");
      }
    }
  });

  it("refuses unknown charge signs and directions rather than silently picking a model", () => {
    for (const [field, values] of [
      ["direction", ["", "north", "X", "xy"]],
      ["charge", ["", "neutral", "electron", "+"]],
    ]) {
      for (const value of values) {
        const parsed = readChargeInputs({
          ...chargeInputs(DEFAULT_CHARGE_SETTINGS),
          [field]: value,
        });
        assert.equal(parsed.kind, "refused");
        assert.equal(parsed.field, field);
        const evaluated = chargeForces({ ...DEFAULT_CHARGE_SETTINGS, [field]: value });
        assert.equal(evaluated.kind, "refused");
        assert.equal(evaluated.field, field);
      }
    }
  });

  it("copies accepted inputs and freezes the snapshot and its vectors", () => {
    const settings = { ...DEFAULT_CHARGE_SETTINGS };
    const result = chargeForces(settings);
    assert.equal(result.kind, "accepted");
    const state = result.snapshot;
    settings.electricVpm = 0;
    settings.direction = "z";
    assert.equal(state.settings.electricVpm, 1000);
    assert.equal(state.settings.direction, "x");
    assert.equal(DEFAULT_CHARGE_SETTINGS.electricVpm, 1000);
    assert.ok(Object.isFrozen(state));
    assert.ok(Object.isFrozen(state.settings));
    for (const name of [
      "velocityMps",
      "electricFieldVpm",
      "magneticFieldT",
      "electricForceN",
      "magneticForceN",
      "totalForceN",
    ]) {
      assert.ok(Object.isFrozen(state[name]), name);
    }
    assert.deepEqual(readChargeInputs(chargeInputs(DEFAULT_CHARGE_SETTINGS)), {
      kind: "accepted",
      settings: DEFAULT_CHARGE_SETTINGS,
    });
  });
});
