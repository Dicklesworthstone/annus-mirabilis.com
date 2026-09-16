import assert from "node:assert/strict";
import test from "node:test";
import { fromSr03Draft, toSr03Draft } from "../experiments/sr03/controls.ts";
import { SR03_DEFAULTS, SR03_PRESETS } from "../experiments/sr03/definition.ts";
import { validateSr03Parameters } from "../experiments/sr03/parameters.ts";
import { decodeSr03Settings, encodeSr03Settings } from "../experiments/sr03/permalink.ts";

test("all presets roundtrip exactly through human draft controls", () => {
  for (const preset of Object.values(SR03_PRESETS)) {
    const draft = toSr03Draft(preset.parameters);
    const roundtripped = fromSr03Draft(draft);
    assert.deepEqual(roundtripped, preset.parameters);
  }
});

test("an unchanged field does not drift when another field is edited", () => {
  const parameters = { ...SR03_DEFAULTS, v: 0.8, L0: 20 };
  const draft = toSr03Draft(parameters);
  draft.R = "2.5";
  const changed = fromSr03Draft(draft);
  assert.equal(changed.R, 2.5);
  assert.equal(changed.v, parameters.v);
  assert.equal(changed.L0, parameters.L0);
  assert.equal(changed.rodRestFrame, parameters.rodRestFrame);
  assert.equal(changed.measuringFrame, parameters.measuringFrame);
});

test("permalink encoding roundtrips valid settings exactly", () => {
  const p = { ...SR03_DEFAULTS, v: 0.75, L0: 15, R: 3 };
  const encoded = encodeSr03Settings(p);
  const decoded = decodeSr03Settings(encoded);
  assert.equal(decoded.kind, "settings");
  if (decoded.kind === "settings") {
    assert.deepEqual(decoded.parameters, p);
  }
  assert.equal(decodeSr03Settings("").kind, "absent");
});

test("permalink decoding rejects invalid or corrupt strings", () => {
  const q = encodeSr03Settings(SR03_DEFAULTS);
  for (const invalid of [
    `${q}&extra=1`,
    q.replace("v=0.6", "v=invalid"),
    q.replace("L0=10", "L0=1e400"),
    q.replace("measuringFrame=K", "measuringFrame=unknown"),
    `?${"x".repeat(4096)}`,
  ]) {
    assert.equal(decodeSr03Settings(invalid).kind, "invalid", invalid);
  }
});

test("draft conversion refuses non-numeric strings for numbers", () => {
  const draft = toSr03Draft(SR03_DEFAULTS);
  draft.v = "not-a-number";
  assert.throws(() => fromSr03Draft(draft));
});

test("validator enforces domain bounds (|v| <= 0.95c, L0 > 0, R > 0)", () => {
  assert.equal(validateSr03Parameters({ ...SR03_DEFAULTS, v: 0.99 }).kind, "refused");
  assert.equal(validateSr03Parameters({ ...SR03_DEFAULTS, v: -0.96 }).kind, "refused");
  assert.equal(validateSr03Parameters({ ...SR03_DEFAULTS, L0: -5 }).kind, "refused");
  assert.equal(validateSr03Parameters({ ...SR03_DEFAULTS, R: 0 }).kind, "refused");
  assert.equal(validateSr03Parameters(SR03_DEFAULTS).kind, "accepted");
});
