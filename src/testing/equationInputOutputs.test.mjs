import assert from "node:assert/strict";
import test from "node:test";
import { BM01_CLASSES, BM01_DEFAULTS, BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createBm01Recording, measureBm01 } from "../workers/operations/bm01.ts";
import { BM01_PROTOCOL, decodeLabResponse } from "../workers/protocol/bm01.ts";

const digest = `source:sha256:${"a".repeat(64)}`;
const p = { ...BM01_DEFAULTS, M: 3, H: 1 };
async function response() {
  const recording = await createBm01Recording(p, { yieldControl: async () => {} });
  assert.equal(recording.kind, "accepted");
  const result = measureBm01(recording.data, p, false);
  assert.equal(result.kind, "accepted");
  const store = createInstanceStore({
    experimentId: "bm-01",
    instanceId: "echo-test",
    initialParameters: p,
    parameterClasses: BM01_CLASSES,
    outputs: BM01_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  return {
    messageKind: "result",
    protocolVersion: BM01_PROTOCOL,
    sourceDigest: digest,
    token,
    result,
  };
}
test("live equation inputs are owned outputs of the accepted calculation, not draft UI values", async () => {
  const r = await response();
  decodeLabResponse(r, r.token, digest);
  for (const [id, value] of [
    ["temperature", p.T],
    ["viscosity", p.eta],
    ["particleRadius", p.a],
    ["observationInterval", p.interval],
    ["boltzmannConstant", 1.380649e-23],
  ]) {
    const output = r.result.data.outputs.find((o) => o.quantityId === id);
    assert.equal(output.status, "value");
    assert.equal(output.value, value);
    assert.equal(output.ownerId, BM01_OUTPUTS[id].ownerId);
  }
});
test("mixed accepted-input echoes are refused even when the output has correct units and owner", async () => {
  for (const id of ["temperature", "viscosity", "particleRadius", "observationInterval"]) {
    const r = await response();
    r.result.data.outputs.find((o) => o.quantityId === id).value *= 2;
    assert.throws(() => decodeLabResponse(r, r.token, digest), /echo/);
  }
});
