/**
 * BM-01's response decoder and the recording's owner (am-frankensim-repin-and-bind-jvhg).
 *
 * A real host-measured snapshot is re-owned in each way a response could name its producer:
 * - all three recording outputs by FrankenSim: admitted;
 * - one of them by the host: refused, because one recording has one producer;
 * - an unregistered owner: refused;
 * - FrankenSim claiming a host reduction: refused.
 * Runs under bun test and node --experimental-strip-types --test.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { BM01_DEFAULTS } from "../../experiments/bm01/definition.ts";
import { createBm01Recording, measureBm01 } from "../operations/bm01.ts";
import { BM01_PROTOCOL, decodeLabResponse } from "./bm01.ts";

const p = { ...BM01_DEFAULTS, M: 20, H: 2, interval: 1 };
const token = {
  experimentId: "bm-01",
  instanceId: "owners",
  runId: "run-owners",
  parentRunId: null,
  actionIndex: 1,
  revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
  parameters: p,
};
const digest = `source:sha256:${"c".repeat(64)}`;
const RECORDING = ["tracerPositions", "traceCoordinates", "recordingDraws"];
let base: Record<string, unknown>;

before(async () => {
  const rec = await createBm01Recording(p, { yieldControl: async () => {} });
  if (rec.kind !== "accepted") throw new Error("host recording refused");
  const m = measureBm01(rec.data, p, false);
  if (m.kind !== "accepted") throw new Error("host measurement refused");
  base = {
    messageKind: "result",
    protocolVersion: BM01_PROTOCOL,
    sourceDigest: digest,
    token,
    result: m,
  };
});

function owned(owners: Record<string, string>) {
  const message = structuredClone(base) as {
    result: { data: { outputs: { quantityId: string; ownerId: string }[] } };
  };
  for (const o of message.result.data.outputs)
    if (owners[o.quantityId]) o.ownerId = owners[o.quantityId] as string;
  return message;
}

describe("BM-01 decoder: who recorded the ensemble", () => {
  it("the host reference as registered: admitted", () => {
    assert.doesNotThrow(() => decodeLabResponse(owned({}), token, digest));
  });
  it("all three recording outputs by fs-wasm.brownian_frames: admitted", () => {
    const all = Object.fromEntries(RECORDING.map((id) => [id, "fs-wasm.brownian_frames"]));
    assert.doesNotThrow(() => decodeLabResponse(owned(all), token, digest));
  });
  it("one recording, two producers: refused", () => {
    assert.throws(
      () =>
        decodeLabResponse(
          owned({
            tracerPositions: "fs-wasm.brownian_frames",
            traceCoordinates: "fs-wasm.brownian_frames",
          }),
          token,
          digest,
        ),
      /different producers/,
    );
  });
  it("an unregistered producer: refused", () => {
    const all = Object.fromEntries(RECORDING.map((id) => [id, "fs-wasm.other_export"]));
    assert.throws(() => decodeLabResponse(owned(all), token, digest), /registered owner/);
  });
  it("FrankenSim claiming a host reduction: refused", () => {
    assert.throws(
      () => decodeLabResponse(owned({ sampleMean: "fs-wasm.brownian_frames" }), token, digest),
      /registered owner/,
    );
  });
});
