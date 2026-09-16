import assert from "node:assert/strict";
import test from "node:test";
import { parseKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import { KITCHEN_OPTIONS } from "../experiments/bm07/kitchen/definition.ts";
import { handoffKitchenToBm07, observationDigest } from "../experiments/bm07/kitchenHandoff.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";

const doc = (patch = {}) => parseKitchenCsv(kitchenFixture(patch));

test("kitchen hand-off reuses analyzeKitchen and does not admit the independent-increment interval on noisy tracks", () => {
  const document = doc({
    metadata: { radius_um: ".5", radius_provenance: "independent", data_origin: "synthetic" },
  });
  const handoff = handoffKitchenToBm07(document, { ...KITCHEN_OPTIONS, constantSet: "metadata" });
  assert.equal(handoff.d, 1);
  assert.ok(handoff.increments.length > 0);
  assert.equal(handoff.admission.kind, "no-value");
  assert.equal(handoff.admission.status, "outside-domain");
  assert.equal(handoff.intervalOwner, "kitchen-noise-aware");
  assert.equal(handoff.numberMeaning, "synthetic-recovery");
  assert.equal(handoff.constantSetId, document.metadata.constant_set_id);
  assert.match(handoff.dataDigest, /^sha256:[a-f0-9]{64}$/);
});

test("changing the declared radius does not change the kitchen observation digest", () => {
  const a = handoffKitchenToBm07(
    doc({ metadata: { radius_um: ".5", radius_provenance: "independent" } }),
  );
  const b = handoffKitchenToBm07(
    doc({ metadata: { radius_um: "1", radius_provenance: "independent" } }),
  );
  assert.equal(a.dataDigest, b.dataDigest);
  assert.deepEqual(a.increments, b.increments);
  assert.notEqual(
    a.analysis.outputs.find((o) => o.quantityId === "molecularNumber")?.value,
    undefined,
  );
});

test("same-displacements radius is not treated as independent evidence", () => {
  const handoff = handoffKitchenToBm07(
    doc({ metadata: { radius_um: ".5", radius_provenance: "same-displacements" } }),
  );
  assert.equal(handoff.radiusProvenance, "same-displacements");
  const n = handoff.analysis.outputs.find((o) => o.quantityId === "molecularNumber");
  assert.equal(n.status, "underdetermined");
});

test("observationDigest is a function of the increment bytes, not of inference temperature", () => {
  const x = new Float64Array([1, 2, 3]);
  assert.equal(observationDigest(x, "track"), observationDigest(x, "track"));
  assert.notEqual(observationDigest(x, "track"), observationDigest(x, "other"));
  const y = new Float64Array([1, 2, 4]);
  assert.notEqual(observationDigest(x), observationDigest(y));
});
