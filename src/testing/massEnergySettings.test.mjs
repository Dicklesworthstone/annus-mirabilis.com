import assert from "node:assert/strict";
import test from "node:test";
import { ME01_DEFAULTS } from "../experiments/me01/definition.ts";
import { decodeMe01Settings, encodeMe01Settings } from "../experiments/me01/permalink.ts";
import { ME02_DEFAULTS } from "../experiments/me02/definition.ts";
import { validateMe02Parameters } from "../experiments/me02/parameters.ts";
import { decodeMe02Settings, encodeMe02Settings } from "../experiments/me02/permalink.ts";
import { createMe02Session, snapshotOutputs } from "../experiments/me02/session.ts";
import { evaluateMe02, evaluateSubtraction } from "../physics/reference/massEnergy.ts";

const close = (a, b, tolerance = 1e-12) =>
  assert.ok(
    Math.abs(a - b) <= tolerance * Math.max(Math.abs(a), Math.abs(b), 1e-300),
    `${a} != ${b}`,
  );

test("ME-01 permalinks include every accepted cancellation, step and offset setting", () => {
  const parameters = {
    ...ME01_DEFAULTS,
    frameSpeed: -0.45,
    emittedEnergyRestFrame: 2.5,
    emissionAngle: 60,
    premise: "relaxed",
    notation: "modern",
    offsetDisplay: "offsets",
    step: "premise-kinetic",
    cancelAngleFactors: false,
    cancelInternalEnergies: false,
    cancelAdditiveConstant: false,
  };
  const decoded = decodeMe01Settings(encodeMe01Settings(parameters));
  assert.equal(decoded.kind, "settings");
  assert.deepEqual(decoded.parameters, parameters);
  assert.equal(encodeMe01Settings(ME01_DEFAULTS), "");
});

test("ME-02 exact settings survive permalink round trips", () => {
  const parameters = {
    ...ME02_DEFAULTS,
    beta: 1e-8,
    emittedEnergy: 1e7,
    energyUnit: "erg",
    notation: "modern",
    speedAxis: "logarithmic",
    showNaive: true,
  };
  const decoded = decodeMe02Settings(encodeMe02Settings(parameters));
  assert.equal(decoded.kind, "settings");
  assert.deepEqual(decoded.parameters, parameters);
});

for (const [decode, speed] of [
  [decodeMe01Settings, "v"],
  [decodeMe02Settings, "beta"],
]) {
  for (const query of [
    `?${speed}=0.6garbage`,
    `?${speed}=1`,
    `?${speed}=0.6&${speed}=0.01`,
    `?${speed}=1e-999`,
    "?L=",
    "?L=Infinity",
    "?L=0",
    "?notation=unknown",
    "?unregistered=1",
  ]) {
    test(`${speed}: refuse ambiguous or unrepresentable settings ${query}`, () => {
      assert.equal(decode(query).kind, "invalid");
    });
  }
  test(`${speed}: empty search is not a request to recalculate`, () =>
    assert.equal(decode("").kind, "none"));
}

test("an erg input is converted to joules before the coefficient owner runs", () => {
  const joules = { ...ME02_DEFAULTS, emittedEnergy: 1, energyUnit: "joule" };
  const ergs = { ...joules, emittedEnergy: 1e7, energyUnit: "erg" };
  assert.deepEqual(snapshotOutputs(ergs), snapshotOutputs(joules));
  const smaller = snapshotOutputs({ ...ergs, emittedEnergy: 1 }).find(
    (o) => o.quantityId === "kineticEnergyDifference",
  );
  close(smaller.value, 2.5e-8);
});

test("input unit reinterpretation creates a new run; invalid converted energy preserves the accepted snapshot", () => {
  const session = createMe02Session("mass-energy-unit-test");
  session.apply({ ...ME02_DEFAULTS, energyUnit: "joule" });
  const before = session.getSnapshot().accepted;
  session.apply({ ...ME02_DEFAULTS, energyUnit: "erg" });
  const after = session.getSnapshot().accepted;
  assert.notEqual(after.runId, before.runId);
  assert.equal(after.revisions.input, before.revisions.input + 1);
  const result = session.apply({
    ...ME02_DEFAULTS,
    emittedEnergy: Number.MIN_VALUE,
    energyUnit: "erg",
  });
  assert.equal(result.kind, "refused");
  assert.equal(session.getSnapshot().accepted, after);
  assert.equal(validateMe02Parameters({ ...ME02_DEFAULTS, showNaive: "false" }).kind, "refused");
});

for (const beta of [0, 1e-8, -1e-8, 0.01, -0.6, 0.6]) {
  test(`ME-01 subtraction preserves the same stable small-speed result as ME-02 at ${beta}`, () => {
    const ledger = evaluateSubtraction(10, beta, 0);
    const coefficient = evaluateMe02({ beta, emittedEnergy: 10 });
    const drop = coefficient.exactDifference;
    assert.equal(drop.status, "value");
    close(ledger.subtractionValue, drop.value);
    if (beta !== 0) assert.ok(ledger.subtractionValue > 0);
    assert.equal(evaluateSubtraction(10, beta, 0, "relaxed").kineticDifference, null);
  });
}
