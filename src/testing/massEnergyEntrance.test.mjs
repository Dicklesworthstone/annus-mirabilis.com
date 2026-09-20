import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateMassEnergyEntrance } from "../../scripts/generate-mass-energy-entrance.mjs";
import { decodeMe01Settings } from "../experiments/me01/permalink.ts";
import { decodeMe02Settings } from "../experiments/me02/permalink.ts";
import { snapshotOutputs } from "../experiments/me02/session.ts";
import { prepareMassEnergyScenario } from "../reader/entrances/massEnergyExample.ts";
import {
  MASS_ENERGY_ENTRANCE_INITIAL as initial,
  reduceMassEnergyEntrance as reduce,
} from "../reader/entrances/massEnergyState.ts";

const fast = prepareMassEnergyScenario("fast");
const slow = prepareMassEnergyScenario("slow");
const close = (a, b, tolerance = 1e-12) =>
  assert.ok(
    Math.abs(a - b) <= tolerance * Math.max(Math.abs(a), Math.abs(b), 1e-300),
    `${a} != ${b}`,
  );

test("two accounts at 60 percent light speed use the real owners, not invented body energies", () => {
  assert.equal(fast.restPulse.value, 5);
  assert.equal(fast.restLight.value, 10);
  close(fast.movingPulse1.value, 2.5);
  close(fast.movingPulse2.value, 10);
  close(fast.movingLight.value, 12.5);
  close(fast.subtraction.value, 2.5);
  close(fast.quadratic.value, 1.8);
  assert.equal(fast.subtraction.ownerId, "massEnergy.subtractionDifference");
  assert.equal(fast.kinetic.ownerId, "massEnergy.kineticEnergyDifference");
  assert.ok(
    fast.bodyEnergies.every((item) => item.status === "symbolic" && !Object.hasOwn(item, "value")),
  );
});

test("slow-speed agreement is close but never relabeled equality", () => {
  close(slow.movingLight.value, 10.000500037503125);
  close(slow.subtraction.value, 0.0005000375031252735);
  close(slow.quadratic.value, 0.0005);
  assert.ok(slow.subtraction.value > slow.quadratic.value);
  assert.ok(slow.discrepancy.value > 0 && slow.discrepancy.value < 0.000076);
  assert.notEqual(slow.subtraction.text, slow.quadratic.text);
});

test("relaxing the premise retains arithmetic but refuses a numeric kinetic interpretation", () => {
  for (const scenario of [fast, slow]) {
    assert.equal(scenario.relaxedKinetic.status, "underdetermined");
    assert.ok(!Object.hasOwn(scenario.relaxedKinetic, "value"));
    assert.deepEqual(scenario.relaxedKinetic.neededInformation, [
      "additive-constant-invariance-under-emission",
    ]);
    assert.ok(Object.isFrozen(scenario));
    assert.ok(Object.isFrozen(scenario.bodyEnergies));
    assert.throws(() => {
      scenario.subtraction.value = 999;
    }, TypeError);
  }
  assert.throws(() => prepareMassEnergyScenario("unknown"), /Unknown/);
});

test("button and drag alignment share one bounded presentation action", () => {
  const aligned = reduce(initial, { type: "align" });
  assert.equal(aligned.phase, 1);
  assert.deepEqual(aligned, reduce(initial, { type: "next" }));
  assert.equal(reduce(aligned, { type: "align" }), aligned);
  let end = aligned;
  for (let i = 0; i < 10; i++) end = reduce(end, { type: "next" });
  assert.equal(end.phase, 3);
  assert.equal(end.revision, 3);
  assert.equal(reduce(end, { type: "next" }), end);
  assert.equal(reduce(initial, { type: "back" }), initial);
  assert.equal(reduce(initial, { type: "scenario", id: "wrong" }), initial);
  const relaxed = reduce(end, { type: "premise", unchanged: false });
  assert.equal(relaxed.phase, 3);
  assert.equal(relaxed.unchangedOffset, false);
  const changed = reduce(relaxed, { type: "scenario", id: "slow" });
  assert.equal(changed.unchangedOffset, false);
  assert.equal(changed.phase, 3);
  assert.equal(initial.phase, 0);
});

test("generated entrance is deterministic, explicitly model-authored, and separate from source review", async () => {
  const a = await generateMassEnergyEntrance();
  const path = new URL("../generated/mass-energy-entrance.json", import.meta.url);
  const bytes = await readFile(path, "utf8");
  const b = await generateMassEnergyEntrance();
  assert.deepEqual(a, b);
  assert.equal(await readFile(path, "utf8"), bytes);
  assert.match(a.sourceDigest, /^source:sha256:[a-f0-9]{64}$/);
  assert.equal(a.record.bridge.reviewState, "draft");
  assert.equal(a.record.bridge.authorship.draftedBy[0].kind, "model");
  assert.equal(a.unit, "J");
});

test("both entrance links restore the actual energy, observer, and unit rather than default examples", () => {
  for (const scenario of [fast, slow]) {
    const ledger = decodeMe01Settings(new URL(scenario.me01Href, "https://example.test").search);
    const coefficient = decodeMe02Settings(
      new URL(scenario.me02Href, "https://example.test").search,
    );
    assert.equal(ledger.kind, "settings");
    assert.equal(coefficient.kind, "settings");
    assert.equal(ledger.parameters.frameSpeed, scenario.beta);
    assert.equal(ledger.parameters.emittedEnergyRestFrame, 10);
    assert.equal(coefficient.parameters.beta, scenario.beta);
    assert.equal(coefficient.parameters.emittedEnergy, 10);
    assert.equal(coefficient.parameters.energyUnit, "joule");
    close(
      snapshotOutputs(coefficient.parameters).find(
        (o) => o.quantityId === "kineticEnergyDifference",
      ).value,
      scenario.subtraction.value,
    );
  }
});
