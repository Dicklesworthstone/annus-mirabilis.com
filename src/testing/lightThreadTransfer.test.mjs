import assert from "node:assert/strict";
import test from "node:test";
import { createLightThreadSession } from "../experiments/lightThread/session.ts";
import { exportLightThreadEvidence } from "../experiments/lightThread/transfer.ts";
import { LIGHT_THREAD_DEFAULTS } from "../physics/reference/lightThread.ts";

const digest = `source:sha256:${"d".repeat(64)}`;

test("downloads carry the accepted constants, owner values, run and historical input provenance", () => {
  for (const constantSetId of ["modern-si-2019", "einstein-1905-light-quanta-printed"]) {
    const session = createLightThreadSession(`export-${constantSetId}`, {
      ...LIGHT_THREAD_DEFAULTS,
      constantSetId,
    });
    const snapshot = session.getSnapshot().accepted;
    const record = JSON.parse(exportLightThreadEvidence(snapshot, digest));
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.modelId, "light-thread-v2");
    assert.equal(record.sourceDigest, digest);
    assert.equal(record.constantSetId, constantSetId);
    assert.equal(record.accepted.parameters.constantSetId, constantSetId);
    assert.equal(record.accepted.runId, snapshot.runId);
    assert.equal(record.accepted.snapshotVersion, snapshot.snapshotVersion);
    assert.deepEqual(record.accepted.results, snapshot.outputs);
    assert.match(record.interpretation.quantumClaim, /Wien regime/);
    assert.match(record.interpretation.massEnergyClaim, /does not require quanta/);
    if (constantSetId === "einstein-1905-light-quanta-printed") {
      assert.equal(record.constants.kind, "printed-historical");
      const entries = Object.fromEntries(
        record.constants.entries.map((entry) => [entry.quantityId, entry]),
      );
      assert.equal(entries.wienConstantBeta.printedStatus, "printed");
      assert.equal(entries.wienConstantBeta.value, 4.866e-11);
      assert.equal(entries.avogadroConstant.evidentialRole, "theoretical-estimate");
      assert.equal(entries.molarGasConstant.printedStatus, "editorial-input");
      assert.equal(entries.speedOfLight.printedStatus, "editorial-input");
      assert.equal(entries.speedOfLight.unit, "cm/s");
      assert.equal(entries.planckConstant, undefined);
    }
    // A refused draft does not change which record is downloadable.
    assert.equal(session.apply({ ...snapshot.parameters, beta: 1 }).kind, "refused");
    assert.equal(
      exportLightThreadEvidence(session.getSnapshot().accepted, digest),
      exportLightThreadEvidence(snapshot, digest),
    );
  }
});

test("incomplete or cross-owner snapshots and absent source identity are refused", () => {
  const snapshot = createLightThreadSession("export-refusal").getSnapshot().accepted;
  assert.throws(
    () => exportLightThreadEvidence(snapshot, ""),
    (error) => error.code === "source-digest-invalid",
  );
  const invalid = [
    { ...snapshot, experimentId: "lq-06" },
    { ...snapshot, final: false },
    { ...snapshot, parameters: { ...snapshot.parameters, constantSetId: "codata-2022" } },
    { ...snapshot, outputs: snapshot.outputs.slice(1) },
    {
      ...snapshot,
      outputs: snapshot.outputs.map((output, i) =>
        i ? output : { ...output, ownerId: "another-owner" },
      ),
    },
    {
      ...snapshot,
      outputs: snapshot.outputs.map((output, i) => (i === 1 ? snapshot.outputs[0] : output)),
    },
  ];
  for (const record of invalid) {
    assert.throws(
      () => exportLightThreadEvidence(record, digest),
      (error) => error.code === "evidence-snapshot-invalid",
    );
  }
});
