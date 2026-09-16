import assert from "node:assert/strict";
import test from "node:test";
import { fromLq06Draft, toLq06Draft } from "../experiments/lq06/controls.ts";
import { LQ06_DEFAULTS, LQ06_PRESETS } from "../experiments/lq06/definition.ts";
import { validateLq06Parameters } from "../experiments/lq06/parameters.ts";
import { decodeLq06Settings, encodeLq06Settings } from "../experiments/lq06/permalink.ts";

test("all presets roundtrip through human draft controls", () => {
  for (const preset of Object.values(LQ06_PRESETS)) {
    const draft = toLq06Draft(preset.parameters);
    const roundtripped = fromLq06Draft(draft);
    assert.equal(roundtripped.selectedSubexpression, preset.parameters.selectedSubexpression);
    assert.equal(roundtripped.proposedEnergyElement, preset.parameters.proposedEnergyElement);
    assert.equal(roundtripped.forkAChoice, preset.parameters.forkAChoice);
    assert.equal(roundtripped.constantSetId, preset.parameters.constantSetId);
    assert.ok(Math.abs(roundtripped.radiationEnergy - preset.parameters.radiationEnergy) < 1e-12);
    assert.ok(Math.abs(roundtripped.frequency - preset.parameters.frequency) < 1e6);
  }
});

test("an unchanged field does not drift when another field is edited", () => {
  const parameters = { ...LQ06_DEFAULTS, temperature: 4000 };
  const draft = toLq06Draft(parameters);
  draft.volumeRatio = "0.25";
  const changed = fromLq06Draft(draft);
  assert.equal(changed.volumeRatio, 0.25);
  assert.equal(changed.temperature, 4000);
  assert.equal(changed.gasParticles, parameters.gasParticles);
  assert.equal(changed.selectedSubexpression, parameters.selectedSubexpression);
});

test("permalink encoding roundtrips valid settings accurately", () => {
  const p = {
    ...LQ06_DEFAULTS,
    radiationEnergy: 15e-9,
    frequency: 7.0e14,
    temperature: 3500,
    selectedSubexpression: "N_E_over_R_beta_nu",
    proposedEnergyElement: "h_nu",
  };
  const encoded = encodeLq06Settings(p);
  const decoded = decodeLq06Settings(encoded);
  assert.equal(decoded.kind, "settings");
  if (decoded.kind === "settings") {
    assert.ok(Math.abs(decoded.parameters.radiationEnergy - p.radiationEnergy) < 1e-12);
    assert.ok(Math.abs(decoded.parameters.frequency - p.frequency) < 1e6);
    assert.equal(decoded.parameters.temperature, p.temperature);
    assert.equal(decoded.parameters.selectedSubexpression, p.selectedSubexpression);
    assert.equal(decoded.parameters.proposedEnergyElement, p.proposedEnergyElement);
  }
  assert.equal(decodeLq06Settings("").kind, "absent");
});

test("permalink decoding rejects invalid or corrupt query strings", () => {
  const q = encodeLq06Settings(LQ06_DEFAULTS);
  for (const invalid of [
    `${q}&extra=1`,
    q.replace("e=9.0556", "e=invalid"),
    q.replace("nu=600.00", "nu=1e400"),
    q.replace("sub=none", "sub=unknown-subexpression"),
    `?${"x".repeat(4096)}`,
  ]) {
    assert.equal(decodeLq06Settings(invalid).kind, "invalid", invalid);
  }
});

test("draft conversion refuses non-numeric strings for numbers", () => {
  const draft = toLq06Draft(LQ06_DEFAULTS);
  const badDraft = { ...draft, frequency: "not-a-frequency" };
  assert.throws(() => fromLq06Draft(badDraft));
});

test("validator enforces strictly positive energy, frequency, and valid choices", () => {
  assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, radiationEnergy: -1e-9 }).kind, "refused");
  assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, frequency: 0 }).kind, "refused");
  assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, gasParticles: -1 }).kind, "refused");
  assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, volumeRatio: 0 }).kind, "refused");
  assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, temperature: -50 }).kind, "refused");
});
