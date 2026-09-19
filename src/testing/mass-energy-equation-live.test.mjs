import assert from "node:assert/strict";
import test from "node:test";
import { readTermValue, resolveSlot, retainedState } from "../equations/live/values.ts";
import { MASS_ENERGY_QUANTITIES } from "../equations/massEnergyQuantities.ts";
import { ME02_DEFAULTS, ME02_OUTPUTS } from "../experiments/me02/definition.ts";
import { createMe02Session, snapshotOutputs, packPrintedConversion } from "../experiments/me02/session.ts";
import { deriveHostExecution } from "../experiments/provenance/executionState.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { printedMassConversion } from "../physics/reference/massEnergy.ts";

const digest = `source:sha256:${"e".repeat(64)}`;
function fixture(id = "me02-equation-test", patch = {}) {
  const parameters = { ...ME02_DEFAULTS, ...patch };
  const example = { sourceDigest: digest, parameters, stepIndex: 0, simulationTime: 0,
    results: snapshotOutputs(parameters).map(encodeResult),
    comparisonResults: snapshotOutputs({ ...parameters, beta: 0.01 }).map(encodeResult),
    printedConversion: packPrintedConversion(printedMassConversion({ emittedEnergyErg: 9e20 })) };
  const session = createMe02Session(id, example);
  return { session, slot() {
    const view = session.getSnapshot();
    return { slot: "primary", experimentId: "me-02", view,
      execution: deriveHostExecution(view, ME02_OUTPUTS, digest,
        view.accepted === session.getServerSnapshot().accepted) };
  } };
}
const term = quantityId => ({ termId: `eq-model-me-live.t.${quantityId}`, quantityId,
  quantity: MASS_ENERGY_QUANTITIES[quantityId], scale: { num: 1, den: 1 } });

for (const energyUnit of ["joule", "erg"]) test(`${energyUnit} inputs attach the real SI result and retain analytic meaning`, () => {
  const f = fixture(`live-${energyUnit}`, { energyUnit, emittedEnergy: energyUnit === "erg" ? 2e7 : 2 });
  const initial = f.slot();
  assert.equal(initial.execution.label, "static");
  const drop = readTermValue(term("kineticEnergyDifference"), initial);
  assert.equal(drop.kind, "value"); assert.equal(drop.text, "0.5"); assert.equal(drop.unit, "J");
  assert.equal(drop.ownerId, "massEnergy.exactDifference");
  const limit = readTermValue(term("inertialMassDecrease"), initial);
  assert.equal(limit.kind, "status"); assert.match(limit.text, /coefficient|limit/i);
  assert.equal(limit.ownerId, "massEnergy.limitingCoefficient");
  const signed = readTermValue(term("massChangeSigned"), initial);
  assert.equal(signed.kind, "value"); assert.ok(Number(signed.text) < 0); assert.equal(signed.unit, "kg");
  assert.equal(f.session.apply({ ...f.session.acceptedParameters(), beta: 0.01 }).kind, "accepted");
  assert.equal(f.slot().execution.label, "host");
  assert.notEqual(readTermValue(term("kineticEnergyDifference"), f.slot()).text, drop.text);
  assert.equal(readTermValue(term("massChangeSigned"), f.slot()).text, signed.text);
});

test("normalized results cannot masquerade as SI despite legacy output contract labels", () => {
  const f = fixture();
  assert.equal(f.slot().view.accepted.outputs.find(o => o.quantityId === "kineticEnergyDifference").unit, "J");
  for (const id of ["kineticEnergyDifference", "finiteSpeedMassProxy", "inertialMassDecrease", "massChangeSigned"]) {
    const value = readTermValue(term(id), f.slot());
    assert.equal(value.kind, "symbolic"); assert.equal(value.ownerId, null);
    assert.match(value.text, /normalized units/);
  }
  f.session.apply({ ...f.session.acceptedParameters(), energyUnit: "joule" });
  assert.equal(readTermValue(term("kineticEnergyDifference"), f.slot()).kind, "value");
  f.session.apply({ ...f.session.acceptedParameters(), energyUnit: "normalized" });
  assert.equal(readTermValue(term("kineticEnergyDifference"), f.slot()).kind, "symbolic");
});

test("missing or unknown accepted unit interpretation cannot supply SI substitutions", () => {
  const f = fixture("units", { energyUnit: "joule" });
  for (const unit of [undefined, "unknown", "J", "constructor"]) {
    const s = f.slot();
    s.view = { ...s.view, accepted: { ...s.view.accepted,
      parameters: { ...s.view.accepted.parameters, energyUnit: unit } } };
    assert.equal(readTermValue(term("kineticEnergyDifference"), s).kind, "symbolic");
  }
});

test("unit admission follows accepted parameters, not a pending request or caller draft", () => {
  for (const energyUnit of ["normalized", "joule"]) {
    const f = fixture(`pending-${energyUnit}`, { energyUnit });
    const s = f.slot();
    s.view = { ...s.view, pending: true, requested: { ...s.view.accepted,
      parameters: { ...s.view.accepted.parameters, energyUnit: energyUnit === "joule" ? "normalized" : "joule" } } };
    assert.equal(readTermValue(term("kineticEnergyDifference"), s).kind, energyUnit === "joule" ? "value" : "symbolic");
    assert.match(retainedState(s), /Previous accepted settings.*pending/);
  }
});

test("invalid edits retain the exact SI values and accepted run identity", () => {
  const f = fixture("refusal", { energyUnit: "joule", emittedEnergy: 2 });
  const accepted = f.slot().view.accepted;
  for (const patch of [{ beta: 1 }, { emittedEnergy: -1 }, { emittedEnergy: Infinity }, { energyUnit: "unknown" }]) {
    assert.equal(f.session.apply({ ...f.session.acceptedParameters(), ...patch }).kind, "refused");
    assert.equal(f.slot().view.accepted, accepted);
    assert.equal(readTermValue(term("kineticEnergyDifference"), f.slot()).text, "0.5");
  }
});

test("zero speed keeps zero drop, inapplicable proxy and analytic coefficient separate", () => {
  const f = fixture("zero", { energyUnit: "joule", beta: 0 });
  const drop = readTermValue(term("kineticEnergyDifference"), f.slot());
  assert.equal(drop.kind, "value"); assert.equal(drop.text, "0");
  const proxy = readTermValue(term("finiteSpeedMassProxy"), f.slot());
  assert.equal(proxy.kind, "status"); assert.match(proxy.text, /zero|0\/0|v = 0/i);
  assert.equal(readTermValue(term("inertialMassDecrease"), f.slot()).kind, "status");
});

test("unbound body energies, offset, frame speed and input energy stay symbolic", () => {
  const f = fixture("unknowns", { energyUnit: "joule" });
  for (const id of ["bodyEnergyRestBefore", "bodyEnergyRestAfter", "bodyEnergyMovingBefore",
    "bodyEnergyMovingAfter", "kineticEnergyBefore", "kineticEnergyAfter", "additiveEnergyConstant",
    "frameSpeed", "emittedEnergyRestFrame", "lorentzFactor", "speedOfLight"]) {
    assert.equal(readTermValue(term(id), f.slot()).kind, "symbolic");
  }
});

test("separate ME-02 placements cannot borrow a result or choose an ambiguous primary", () => {
  const a = fixture("one", { energyUnit: "joule", emittedEnergy: 1 });
  const b = fixture("two", { energyUnit: "joule", emittedEnergy: 2 });
  assert.equal(readTermValue(term("kineticEnergyDifference"), a.slot()).text, "0.25");
  assert.equal(readTermValue(term("kineticEnergyDifference"), b.slot()).text, "0.5");
  assert.equal(resolveSlot([a.slot(), b.slot()], "me-02", "primary").kind, "ambiguous");
  assert.equal(resolveSlot([a.slot()], "bm-01", "primary").kind, "unresolved");
});

test("missing provenance and mismatched units or meanings never earn substitutions", () => {
  const f = fixture("contracts", { energyUnit: "joule" });
  const s = f.slot();
  s.execution = deriveHostExecution(s.view, ME02_OUTPUTS, "not-a-digest", false);
  assert.equal(readTermValue(term("kineticEnergyDifference"), s).kind, "symbolic");
  for (const patch of [{ unit: "erg" }, { semanticKind: "quadratic-kinetic-energy" }]) {
    const slot = f.slot();
    slot.view = { ...slot.view, accepted: { ...slot.view.accepted, outputs: slot.view.accepted.outputs.map(o =>
      o.quantityId === "kineticEnergyDifference" ? { ...o, ...patch } : o) } };
    assert.equal(readTermValue(term("kineticEnergyDifference"), slot).kind, "symbolic");
  }
});
