import assert from "node:assert/strict";
import test from "node:test";
import { fromBm04Draft, toBm04Draft } from "../experiments/bm04/controls.ts";
import { BM04_DEFAULTS, BM04_PRESETS } from "../experiments/bm04/definition.ts";
import { validateBm04Parameters } from "../experiments/bm04/parameters.ts";
import { decodeBm04Settings, encodeBm04Settings } from "../experiments/bm04/permalink.ts";

test("all presets roundtrip exactly through human draft controls", () => {
  for (const preset of Object.values(BM04_PRESETS)) {
    const draft = toBm04Draft(preset.parameters);
    const roundtripped = fromBm04Draft(draft);
    assert.deepEqual(roundtripped, preset.parameters);
  }
});

test("an unchanged field does not drift when another field is edited", () => {
  const parameters = { ...BM04_DEFAULTS, F: 2.5e-15, T: 300 };
  const draft = toBm04Draft(parameters);
  draft.m = "2";
  const changed = fromBm04Draft(draft);
  assert.equal(changed.m, 2);
  assert.equal(changed.F, parameters.F);
  assert.equal(changed.T, parameters.T);
  assert.equal(changed.eta, parameters.eta);
});

test("permalink encoding roundtrips valid settings exactly", () => {
  const p = { ...BM04_DEFAULTS, F: 1.5e-15, m: 0.5, T: 310.15 };
  const encoded = encodeBm04Settings(p);
  const decoded = decodeBm04Settings(encoded);
  assert.equal(decoded.kind, "settings");
  if (decoded.kind === "settings") {
    assert.deepEqual(decoded.parameters, p);
  }
  assert.equal(decodeBm04Settings("").kind, "absent");
});

test("permalink decoding rejects invalid or corrupt strings", () => {
  const q = encodeBm04Settings(BM04_DEFAULTS);
  for (const invalid of [
    `${q}&extra=1`,
    q.replace("m=1", "m=invalid"),
    q.replace("T=293.15", "T=1e400"),
    q.replace("profile=uniform", "profile=unknown"),
    `?${"x".repeat(4096)}`,
  ]) {
    assert.equal(decodeBm04Settings(invalid).kind, "invalid", invalid);
  }
});

test("draft conversion refuses non-numeric strings", () => {
  const draft = toBm04Draft(BM04_DEFAULTS);
  draft.T = "not-a-number";
  assert.throws(() => fromBm04Draft(draft));
});

test("validator enforces physics parameter bounds without silently clamping", () => {
  assert.equal(validateBm04Parameters({ ...BM04_DEFAULTS, T: -5 }).kind, "refused");
  assert.equal(validateBm04Parameters({ ...BM04_DEFAULTS, eta: 0 }).kind, "refused");
  assert.equal(validateBm04Parameters({ ...BM04_DEFAULTS, a: -1e-6 }).kind, "refused");
  assert.equal(validateBm04Parameters({ ...BM04_DEFAULTS, m: -1 }).kind, "refused");
  assert.equal(validateBm04Parameters(BM04_DEFAULTS).kind, "accepted");
});
