import assert from "node:assert/strict";
import test from "node:test";
import { fromInferenceDraft, toInferenceDraft } from "../experiments/bm07/controls.ts";
import { BM07_DEFAULTS } from "../experiments/bm07/definition.ts";
import { validateBm07Parameters } from "../experiments/bm07/parameters.ts";
import { decodeBm07Settings, encodeBm07Settings } from "../experiments/bm07/permalink.ts";

const p = { ...BM07_DEFAULTS, seed: "18446744073709551615", radiusKnown: true };
test("inference controls roundtrip SI values and full seeds without changing generator assumptions", () => {
  const draft = toInferenceDraft(p);
  assert.equal(draft.a, "0.5");
  assert.equal(draft.eta, "1");
  assert.equal(draft.coverage, "95");
  assert.equal(draft.seed, p.seed);
  assert.deepEqual(fromInferenceDraft(draft), p);
  for (const patch of [
    { dt: "NaN" },
    { seed: "9007199254740993.0" },
    { radiusKnown: "yes" },
    { a: "0" },
    { M: "1001" },
    { coverage: "100" },
  ])
    assert.throws(() => fromInferenceDraft({ ...draft, ...patch }));
});
test("accepted settings links roundtrip without scheduling coverage work or rounding seed bits", () => {
  const query = encodeBm07Settings({ ...p, coverageTrials: 100 });
  const decoded = decodeBm07Settings(query);
  assert.equal(decoded.kind, "settings");
  assert.deepEqual(decoded.parameters, { ...p, coverageTrials: 0 });
  assert.equal(decodeBm07Settings("").kind, "absent");
  for (const bad of [
    `${query}&a=1`,
    `${query}&private=value`,
    query.replace("inference=1", "inference=2"),
    query.replace("coverageTrials=0", "coverageTrials=100"),
    query.replace("radiusKnown=true", "radiusKnown=yes"),
    "?inference=1",
  ])
    assert.equal(decodeBm07Settings(bad).kind, "invalid", bad);
});
test("closed input validation never evaluates hostile getters or accepts unknown fields", () => {
  const hostile = { ...p };
  Object.defineProperty(hostile, "T", {
    get: () => {
      throw new Error("should not run");
    },
  });
  assert.equal(validateBm07Parameters(hostile).kind, "refused");
  assert.equal(validateBm07Parameters({ ...p, unknown: 1 }).kind, "refused");
  assert.equal(validateBm07Parameters({ ...p, seed: 1 }).kind, "refused");
});
