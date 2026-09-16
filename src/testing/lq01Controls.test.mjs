import assert from "node:assert/strict";
import test from "node:test";
import { fromLq01Draft, toLq01Draft } from "../experiments/lq01/controls.ts";
import { LQ01_DEFAULTS, LQ01_PRESETS } from "../experiments/lq01/definition.ts";
import { validateLq01Parameters } from "../experiments/lq01/parameters.ts";
import { decodeLq01Settings, encodeLq01Settings } from "../experiments/lq01/permalink.ts";

test("all LQ-01 presets roundtrip exactly through human draft controls", () => {
  for (const preset of Object.values(LQ01_PRESETS)) {
    const draft = toLq01Draft(preset.parameters);
    const roundtripped = fromLq01Draft(draft);
    assert.deepEqual(roundtripped, preset.parameters);
  }
});

test("an unchanged field does not drift when another field is edited", () => {
  const parameters = { ...LQ01_DEFAULTS, A1: 1.5, delta: 1.2 };
  const draft = toLq01Draft(parameters);
  draft.A2 = "0.75";
  const changed = fromLq01Draft(draft);
  assert.equal(changed.A2, 0.75);
  assert.equal(changed.A1, parameters.A1);
  assert.equal(changed.delta, parameters.delta);
  assert.equal(changed.wavelength, parameters.wavelength);
});

test("permalink encoding roundtrips valid settings exactly", () => {
  const p = { ...LQ01_DEFAULTS, A1: 1.2, A2: 0.8, delta: 1.57 };
  const encoded = encodeLq01Settings(p);
  const decoded = decodeLq01Settings(encoded);
  assert.equal(decoded.kind, "settings");
  if (decoded.kind === "settings") {
    assert.deepEqual(decoded.parameters, p);
  }
  assert.equal(decodeLq01Settings("").kind, "absent");
});

test("permalink decoding rejects invalid or corrupt strings", () => {
  const q = encodeLq01Settings(LQ01_DEFAULTS);
  for (const invalid of [
    `${q}&extra=1`,
    q.replace("A1=1", "A1=invalid"),
    q.replace("r=1", "r=-5"),
    q.replace("readout=time-average", "readout=unknown"),
    `?${"x".repeat(4096)}`,
  ]) {
    assert.equal(decodeLq01Settings(invalid).kind, "invalid", invalid);
  }
});

test("draft conversion refuses non-numeric strings", () => {
  const draft = toLq01Draft(LQ01_DEFAULTS);
  draft.delta = "not-a-number";
  assert.throws(() => fromLq01Draft(draft));
});

test("validator enforces physics parameter bounds without silently clamping", () => {
  assert.equal(validateLq01Parameters({ ...LQ01_DEFAULTS, A1: -1 }).kind, "refused");
  assert.equal(validateLq01Parameters({ ...LQ01_DEFAULTS, wavelength: 0 }).kind, "refused");
  assert.equal(validateLq01Parameters({ ...LQ01_DEFAULTS, separation: -1 }).kind, "refused");
  assert.equal(validateLq01Parameters({ ...LQ01_DEFAULTS, screenDistance: 0 }).kind, "refused");
  assert.equal(validateLq01Parameters({ ...LQ01_DEFAULTS, r: 0 }).kind, "refused");
  assert.equal(validateLq01Parameters({ ...LQ01_DEFAULTS, P: 0 }).kind, "refused");
  assert.equal(validateLq01Parameters(LQ01_DEFAULTS).kind, "accepted");
});
