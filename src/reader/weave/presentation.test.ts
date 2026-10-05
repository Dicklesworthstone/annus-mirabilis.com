import assert from "node:assert/strict";
import test from "node:test";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeaveFlag, WeavePredicate } from "../../experiments/weave/types.ts";
import { BM01_WEAVE_PASSAGES, withWeavePassages, weavePassageHref } from "./brownianPassages.ts";
import { conditionOutputs, unlitExplanation, weaveEvidence } from "./evidence.ts";

const predicate: WeavePredicate = {
  id: "bm01-s4-cancellation", instrumentId: "bm-01", meaning: "agreement-within-stated-bound",
  conditions: [{ kind: "agreement", statisticQuantityId: "x", sampleCountQuantityId: "n",
    minimumSampleSize: 100, boundFamily: "owner-band", enterAlpha: 0.001, exitAlpha: 0.0001,
    lowerBoundQuantityId: "lo", upperBoundQuantityId: "hi" }],
  targets: ["bm-s4-cancellation"], pointerText: "sample size 400, seed 1905",
};
const flag: WeaveFlag = {
  predicateId: predicate.id, meaning: predicate.meaning, lit: false, state: "hold",
  targets: predicate.targets, pointerText: predicate.pointerText,
};
const accepted = (outputs: unknown[]) => ({ outputs }) as AcceptedSnapshot;
const output = (quantityId: string, value: number, unit = "m") => ({
  quantityId, status: "value", value, unit, ownerId: "numerical-owner", semanticKind: "test",
});

test("source mapping replaces legacy addresses without changing any condition or scientific meaning", () => {
  const mapped = withWeavePassages([predicate], BM01_WEAVE_PASSAGES)[0];
  assert.ok(mapped);
  assert.equal(mapped.conditions, predicate.conditions);
  assert.equal(mapped.meaning, predicate.meaning);
  assert.deepEqual(mapped.targets, ["s4-p6-s9"]);
  assert.deepEqual(predicate.targets, ["bm-s4-cancellation"]);
  assert.ok(Object.isFrozen(mapped) && Object.isFrozen(mapped.targets));
});
test("live pointer prose does not assert the default sample size or seed", () => {
  const mapped = withWeavePassages([predicate], BM01_WEAVE_PASSAGES)[0];
  assert.ok(mapped);
  assert.doesNotMatch(mapped.pointerText, /400|1905|proved|verified theory/);
  assert.match(mapped.pointerText, /published/);
});
test("a newly registered predicate is never redirected to the nearest known sentence", () => {
  const unknown = { ...predicate, id: "new-predicate" };
  assert.equal(withWeavePassages([unknown], BM01_WEAVE_PASSAGES)[0], unknown);
});
test("both standalone faces address the same canonical source sentence", () => {
  for (const passage of Object.values(BM01_WEAVE_PASSAGES)) {
    assert.equal(weavePassageHref("brownian-motion", passage.sentenceId, "german"),
      `/papers/brownian-motion/view/german/#${passage.sentenceId}`);
    assert.equal(new URL(weavePassageHref("brownian-motion", passage.sentenceId, "english"), "https://example.test").hash,
      `#${passage.sentenceId}`);
  }
});
test("every kind of predicate declares exactly the outputs its evidence disclosure reads", () => {
  assert.deepEqual(conditionOutputs(predicate.conditions[0]!), ["x", "n", "lo", "hi"]);
  assert.deepEqual(conditionOutputs({ kind: "regime", on: "constantSet", equals: "modern" }), []);
  assert.deepEqual(conditionOutputs({ kind: "regime", on: "regime", equals: "selected" }), ["regime"]);
  assert.deepEqual(conditionOutputs({ kind: "status", quantityId: "x", equals: "value" }), ["x"]);
});
test("evidence retains microscopic units and the published number without rounding to zero", () => {
  const rows = weaveEvidence(predicate, accepted([output("x", 8e-15, "N"), output("n", 173, "1")]));
  assert.equal(rows.find((row) => row.id === "x")?.value, "8e-15 N");
  assert.equal(rows.find((row) => row.id === "n")?.value, "173 1");
  assert.equal(rows.find((row) => row.id === "x")?.owner, "numerical-owner");
});
test("absent, ambiguous, nonfinite and nonscalar evidence remains visibly unavailable", () => {
  for (const outputs of [[], [output("x", 1), output("x", 2)]]) {
    assert.equal(weaveEvidence(predicate, accepted(outputs))[0]?.value, "Unavailable");
  }
  for (const value of [NaN, Infinity, new Float64Array([10])]) {
    assert.equal(weaveEvidence(predicate, accepted([{ ...output("x", 1), value }]))[0]?.value, "No scalar value");
  }
});
test("non-value statuses are not converted to a number in the evidence disclosure", () => {
  const rows = weaveEvidence(predicate, accepted([{ ...output("x", 12), status: "underdetermined" }]));
  assert.equal(rows[0]?.value, "underdetermined");
});
test("unlit and not-evaluable comparisons never assert experimental disproof", () => {
  assert.match(unlitExplanation({ ...flag, state: "not-evaluable" }), /not evidence of disagreement/);
  assert.match(unlitExplanation(flag), /not a test of nature/);
  assert.match(unlitExplanation({ ...flag, meaning: "assumption-active" }), /not selected/);
  assert.match(unlitExplanation({ ...flag, meaning: "outside-selected-domain" }), /not active/);
});
