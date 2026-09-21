import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeLightThreadParameters,
  LIGHT_THREAD_DEFAULTS as defaults,
  encodeLightThreadParameters,
  evaluateLightThread,
  LIGHT_THREAD_BOUNDS,
  validateLightThreadParameters,
} from "../physics/reference/lightThread.ts";

// Independent analytic oracle for the compositor. Production uses waves.ts owners.
const q = (beta, theta) => (1 - beta * Math.cos(theta)) / Math.sqrt((1 - beta) * (1 + beta));
const owners = {
  constantSetId: "modern-si-2019",
  planckConstant: 6.62607015e-34,
  speedOfLight: 299792458,
  frequencyFactor: q,
  energyFactor: q,
};
const close = (actual, expected, tolerance = 2e-12) =>
  assert.ok(
    Math.abs(actual - expected) <=
      tolerance * Math.max(Math.abs(actual), Math.abs(expected), Number.MIN_VALUE),
    `${actual} ≠ ${expected}`,
  );
function run(p = defaults, dependencies = owners) {
  const result = evaluateLightThread(p, dependencies);
  assert.equal(result.kind, "accepted");
  return result.snapshot;
}

test("receding pulse: ν, E and hν halve together while E/(hν) is unchanged", () => {
  const { values: v } = run();
  close(v.frequencyFactor, 0.5);
  close(v.energyFactor, 0.5);
  close(v.frequencyMoving, defaults.frequencyHz / 2);
  close(v.energyMoving, 0.5);
  close(v.quantumEnergyMoving, v.quantumEnergyStationary / 2);
  close(v.quantumRatioMoving, v.quantumRatioStationary);
});

test("balanced emission is two pulses, not one photon assigned a rest mass", () => {
  const { values: v } = run();
  assert.equal(v.pulseInvariantMass, 0);
  close(v.pulseEnergyEquivalent, 1 / owners.speedOfLight ** 2);
  close(v.pairInvariantMass, 2 / owners.speedOfLight ** 2);
  close(v.bodyMassLoss, v.pairInvariantMass);
  close(v.oppositePulseEnergyMoving, 2);
  close(v.pairEnergyMoving, 2.5);
  close(v.pairEnergyStationary, 2);
});

test("cross-frame invariants and balanced-pair energy across signed boosts and angles", () => {
  for (const beta of [-0.999999, -0.9, -0.6, 0, 0.6, 0.9, 0.999999]) {
    for (const angleDeg of [0, 30, 60, 90, 120, 150, 180]) {
      const p = { ...defaults, beta, angleDeg };
      const { values: v } = run(p);
      close(v.quantumRatioMoving, v.quantumRatioStationary);
      close(v.pairEnergyMoving, (2 * p.pulseEnergyJ) / Math.sqrt((1 - beta) * (1 + beta)));
      close(v.pairInvariantMass, (2 * p.pulseEnergyJ) / owners.speedOfLight ** 2);
      const reversed = run({ ...p, beta: -beta, angleDeg: 180 - angleDeg });
      close(v.frequencyMoving, reversed.values.frequencyMoving, 2e-10);
    }
  }
});

test("frequency and total pulse energy are independent controls", () => {
  const base = run().values;
  const frequency = run({ ...defaults, frequencyHz: 2 * defaults.frequencyHz }).values;
  const energy = run({ ...defaults, pulseEnergyJ: 2 }).values;
  close(frequency.quantumEnergyStationary, 2 * base.quantumEnergyStationary);
  close(frequency.quantumRatioStationary, base.quantumRatioStationary / 2);
  assert.equal(frequency.bodyMassLoss, base.bodyMassLoss);
  assert.equal(energy.quantumEnergyStationary, base.quantumEnergyStationary);
  close(energy.quantumRatioStationary, 2 * base.quantumRatioStationary);
  close(energy.bodyMassLoss, 2 * base.bodyMassLoss);
});

test("the compositor does not hide disagreement between energy and frequency owners", () => {
  const v = run(defaults, { ...owners, energyFactor: () => 1 }).values;
  assert.notEqual(v.frequencyFactor, v.energyFactor);
  assert.notEqual(v.quantumRatioStationary, v.quantumRatioMoving);
});

test("accepted snapshots detach inputs and are deeply frozen", () => {
  const input = { ...defaults };
  const snapshot = run(input);
  input.beta = 0;
  assert.equal(snapshot.parameters.beta, 0.6);
  for (const value of [snapshot, snapshot.parameters, snapshot.values])
    assert.ok(Object.isFrozen(value));
});

test("invalid settings are refused before numerical owners run", () => {
  const bomb = {
    ...owners,
    frequencyFactor: () => {
      throw new Error("must not run");
    },
  };
  for (const key of Object.keys(defaults)) {
    for (const invalid of [NaN, Infinity, -Infinity, "0", null, undefined]) {
      assert.equal(evaluateLightThread({ ...defaults, [key]: invalid }, bomb).kind, "refused");
    }
    const missing = { ...defaults };
    delete missing[key];
    assert.equal(validateLightThreadParameters(missing).kind, "refused");
  }
  for (const input of [
    null,
    [],
    {},
    "state",
    { ...defaults, extra: 1 },
    { ...defaults, beta: 1 },
    { ...defaults, pulseEnergyJ: 0 },
    Object.create(defaults),
  ]) {
    assert.equal(evaluateLightThread(input, bomb).kind, "refused");
  }
});

test("numeric admission boundaries stay finite without clamping", () => {
  for (const frequencyHz of [
    LIGHT_THREAD_BOUNDS.frequencyHz.min,
    LIGHT_THREAD_BOUNDS.frequencyHz.max,
  ]) {
    for (const pulseEnergyJ of [
      LIGHT_THREAD_BOUNDS.pulseEnergyJ.min,
      LIGHT_THREAD_BOUNDS.pulseEnergyJ.max,
    ]) {
      for (const beta of [LIGHT_THREAD_BOUNDS.beta.min, LIGHT_THREAD_BOUNDS.beta.max]) {
        for (const angleDeg of [0, 90, 180]) {
          const v = run({ frequencyHz, pulseEnergyJ, beta, angleDeg }).values;
          assert.ok(Object.values(v).every(Number.isFinite));
        }
      }
    }
  }
});

test("bad owner results are unavailable, not a fabricated scientific zero", () => {
  for (const value of [NaN, Infinity, 0, -1]) {
    assert.equal(
      evaluateLightThread(defaults, { ...owners, energyFactor: () => value }).kind,
      "unavailable",
    );
  }
  for (const planckConstant of [0, NaN, Infinity, Number.MIN_VALUE]) {
    assert.equal(evaluateLightThread(defaults, { ...owners, planckConstant }).kind, "unavailable");
  }
});

test("bookmarks round-trip canonically and reject partial, duplicate, or hostile state", () => {
  const encoded = encodeLightThreadParameters(defaults);
  const decoded = decodeLightThreadParameters(encoded);
  assert.equal(decoded.kind, "accepted");
  assert.deepEqual(decoded.parameters, defaults);
  assert.equal(encodeLightThreadParameters(decoded.parameters), encoded);
  const queries = [
    "",
    "lt=2",
    `${encoded}&beta=0`,
    encoded.replace("lt=1", "lt=1&lt=1"),
    `${encoded}&evil=1`,
    encoded.replace("frequencyHz=500000000000000", "frequencyHz="),
    encoded.replace("beta=0.6", "beta=0x1"),
    encoded.replace("beta=0.6", "beta=Infinity"),
    encoded.replace("beta=0.6", "beta=%20"),
    encoded.replace("beta=0.6", "beta=1"),
    "x".repeat(1025),
  ];
  for (const query of queries)
    assert.equal(decodeLightThreadParameters(query).kind, "refused", query);
  // The encode guard refuses a CODED refusal now, not a bare RangeError. 0f54101b
  // replaced `throw new RangeError(checked.reason)` with
  // `throw new ExperimentRuntimeError("parameters-rejected", checked.reason,
  // "light-thread")` under am-p465, which is the migration working: an untyped throw
  // carrying only prose became one the coded-refusal scanner reads by construction.
  //
  // So this assertion is tightened rather than relaxed to fit. Asserting the class
  // alone would pass for any coded refusal from anywhere in the file; it now requires
  // the code, the experiment id, and the authored sentence, and would fail again if
  // the throw regressed to a bare Error or lost its bound from the message.
  assert.throws(
    () => encodeLightThreadParameters({ ...defaults, beta: 1 }),
    (error) => {
      assert.equal(
        error.name,
        "ExperimentRuntimeError",
        "the encode guard must throw a coded refusal",
      );
      assert.equal(error.code, "parameters-rejected");
      assert.equal(error.experimentId, "light-thread");
      assert.match(error.message, /between -0\.999999 and 0\.999999/);
      assert.match(error.message, /admission bounds/);
      return true;
    },
  );
});
