/**
 * An output contract can register more than one owner, and still refuses every other owner
 * (am-frankensim-repin-and-bind-jvhg). Runs under bun test and node --experimental-strip-types --test.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInstanceStore, type OutputContract, ownerAdmitted } from "./instanceStore.ts";

const contracts: Record<string, OutputContract> = {
  positions: {
    statuses: ["value"],
    unit: "m",
    semanticKind: "synthetic-tracer-endpoints-xyz",
    ownerId: "diffusion.recordTracers",
    admittedOwnerIds: ["fs-wasm.brownian_frames"],
  },
  mean: {
    statuses: ["value"],
    unit: "m",
    semanticKind: "sample-coordinate-mean",
    ownerId: "diffusion.ensembleMoments",
  },
};

function publishAs(owners: Record<string, string>) {
  const store = createInstanceStore({
    experimentId: "owners-test",
    instanceId: "owners-test-1",
    initialParameters: { a: 1 },
    parameterClasses: { a: "input" },
    outputs: contracts,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  return store.publish({
    ...token,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    outputs: Object.entries(owners).map(([quantityId, ownerId]) => ({
      quantityId,
      unit: contracts[quantityId]?.unit ?? "",
      semanticKind: contracts[quantityId]?.semanticKind ?? "",
      ownerId,
      status: "value" as const,
      value: 1,
    })),
  });
}

describe("admitted owners", () => {
  it("the registered owner and the admitted alternate are both accepted", () => {
    assert.deepEqual(publishAs({ positions: "diffusion.recordTracers" }), { accepted: true });
    assert.deepEqual(publishAs({ positions: "fs-wasm.brownian_frames" }), { accepted: true });
  });
  it("any other owner is refused as a malformed publication", () => {
    assert.deepEqual(publishAs({ positions: "fs-wasm.something_else" }), {
      accepted: false,
      reason: "malformed-publication",
    });
  });
  it("an alternate registered for one output does not leak to another", () => {
    assert.deepEqual(publishAs({ mean: "fs-wasm.brownian_frames" }), {
      accepted: false,
      reason: "malformed-publication",
    });
    assert.equal(ownerAdmitted(contracts.mean as OutputContract, "fs-wasm.brownian_frames"), false);
  });
});
