import assert from "node:assert/strict";
import test from "node:test";
import { fromTracerDraft, toTracerDraft } from "../experiments/bm01/controls.ts";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { validateBm01Parameters } from "../experiments/bm01/parameters.ts";
import { decodeBm01Settings, encodeBm01Settings } from "../experiments/bm01/permalink.ts";

test("tracer controls preserve SI physics and all 64 seed bits exactly", () => {
  for (const seed of ["0", "9007199254740992", "9007199254740993", "18446744073709551615"]) {
    const p = { ...BM01_DEFAULTS, seed };
    assert.deepEqual(fromTracerDraft(toTracerDraft(p)), p);
    const draft = toTracerDraft(p);
    draft.interval = "4";
    assert.deepEqual(fromTracerDraft(draft), { ...p, interval: 4 });
  }
});
test("accepted trial settings roundtrip with version, seed and explicit grid", () => {
  const p = { ...BM01_DEFAULTS, seed: "9007199254740993", axis: 2, d: 3, statistic: "apparent" };
  assert.deepEqual(decodeBm01Settings(encodeBm01Settings(p)), { kind: "settings", parameters: p });
  assert.equal(decodeBm01Settings("").kind, "absent");
});
test("links refuse ambiguous, incomplete, nonfinite, and lossy seed data", () => {
  const q = encodeBm01Settings(BM01_DEFAULTS);
  for (const invalid of [
    `${q}&seed=42`,
    `${q}&extra=1`,
    q.replace("tracers=1", "tracers=2"),
    q.replace("seed=1905", "seed=01"),
    q.replace("seed=1905", "seed=1e5"),
    q.replace("T=293.15", "T=1e400"),
    q.replace("&H=10", ""),
    `?${"x".repeat(4096)}`,
  ])
    assert.equal(decodeBm01Settings(invalid).kind, "invalid", invalid);
  assert.throws(() => encodeBm01Settings({ ...BM01_DEFAULTS, seed: 42 }));
});
test("typed controls refuse malformed numbers and do not clamp observation times", () => {
  const d = toTracerDraft(BM01_DEFAULTS);
  d.T = "abc";
  assert.throws(() => fromTracerDraft(d));
  assert.equal(validateBm01Parameters({ ...BM01_DEFAULTS, interval: 11 }).kind, "refused");
  assert.equal(validateBm01Parameters({ ...BM01_DEFAULTS, M: 0 }).kind, "refused");
  assert.equal(validateBm01Parameters({ ...BM01_DEFAULTS, interval: 0.015 }).kind, "accepted"); // The recording owner supplies its grid-specific refusal.
});
