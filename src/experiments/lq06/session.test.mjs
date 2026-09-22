import assert from "node:assert/strict";
import test from "node:test";
import { LQ06_DEFAULTS, LQ06_PRESETS } from "./definition.ts";
import { createLq06Session, evaluateLq06 } from "./session.ts";

const value = (outputs, id) => {
  const r = outputs.find((o) => o.quantityId === id);
  assert.equal(r?.status, "value");
  return r.value;
};
const close = (a, b) => assert.ok(Math.abs(a / b - 1) < 2e-13, `${a} != ${b}`);

test("modern and historical computations use their declared constants", () => {
  const modern = evaluateLq06(LQ06_DEFAULTS);
  close(value(modern, "quantumEnergy"), 3.97564209e-19);
  const printed = evaluateLq06(LQ06_PRESETS.historicalConstants.parameters);
  close(value(printed, "quantumEnergy"), 3.9322327390599675e-19);
  close(value(printed, "meanQuantumEnergyWien"), 1.212155591572123e-19);
  close(value(printed, "gasEntropyVolumeCoefficient"), (10 * 8.31) / 6.17e23);
  assert.notEqual(
    value(modern, "effectiveIndependentCount"),
    value(printed, "effectiveIndependentCount"),
  );
});
test("a full preset updates input, measurement, and presentation together", () => {
  const session = createLq06Session("mixed");
  session.apply({ radiationEnergy: 2e-9, volumeRatio: 2, selectedSubexpression: "E" });
  const result = session.apply(LQ06_PRESETS.historicalConstants.parameters);
  assert.equal(result.kind, "accepted");
  const accepted = session.getSnapshot().accepted;
  assert.deepEqual(accepted.parameters, LQ06_PRESETS.historicalConstants.parameters);
  assert.deepEqual(accepted.outputs, evaluateLq06(accepted.parameters));
  assert.equal(value(accepted.outputs, "correspondenceVerdict"), 1);
});
test("presentation preserves the run, changing constants creates a new run", () => {
  const session = createLq06Session("classes");
  const first = session.getSnapshot().accepted;
  session.apply({ selectedSubexpression: "N_E_over_R_beta_nu" });
  assert.equal(session.getSnapshot().accepted.runId, first.runId);
  assert.deepEqual(session.getSnapshot().accepted.revisions, first.revisions);
  session.apply({ constantSetId: "einstein-1905-light-quanta-printed" });
  assert.notEqual(session.getSnapshot().accepted.runId, first.runId);
});
test("invalid or nonrepresentable requests leave accepted and requested identities untouched", () => {
  const session = createLq06Session("refusal");
  const before = session.getSnapshot();
  for (const patch of [
    { constantSetId: "not-real" },
    { radiationEnergy: Number.MAX_VALUE },
    { frequency: Number.MIN_VALUE },
  ]) {
    assert.equal(session.apply(patch).kind, "refused");
    assert.equal(session.getSnapshot(), before);
  }
});
test("a getter patch never runs and cannot alter accepted state", () => {
  const session = createLq06Session("accessor");
  let calls = 0;
  const before = session.getSnapshot();
  assert.equal(
    session.apply({
      get frequency() {
        calls++;
        return 1;
      },
    }).kind,
    "refused",
  );
  assert.equal(calls, 0);
  assert.equal(session.getSnapshot(), before);
});
test("stale serialized output cannot impersonate historical results", () => {
  const p = LQ06_PRESETS.historicalConstants.parameters;
  const session = createLq06Session("prepared", {
    sourceDigest: "stale-fixture",
    parameters: p,
    results: evaluateLq06(LQ06_DEFAULTS).map((o) => JSON.stringify(o)),
    stepIndex: 0,
    simulationTime: 0,
  });
  assert.deepEqual(session.getSnapshot().accepted.outputs, evaluateLq06(p));
});
test("server snapshot is stable and instances stay independent", () => {
  const a = createLq06Session("a"),
    b = createLq06Session("b");
  const server = a.getServerSnapshot(),
    before = b.getSnapshot();
  a.apply({ frequency: 9e14 });
  assert.equal(a.getServerSnapshot(), server);
  assert.equal(b.getSnapshot(), before);
});
test("volume one has zero entropy changes without suppressing finite coefficients", () => {
  const outputs = evaluateLq06({ ...LQ06_DEFAULTS, volumeRatio: 1 });
  assert.equal(value(outputs, "radiationEntropy"), 0);
  assert.equal(value(outputs, "gasEntropy"), 0);
  assert.ok(value(outputs, "entropyVolumeCoefficient") > 0);
});
