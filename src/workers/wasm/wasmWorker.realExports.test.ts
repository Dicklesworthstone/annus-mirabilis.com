/**
 * The generic WASM worker runs the pinned module's real exports (am-frankensim-repin-and-bind-jvhg):
 * - brownian_frames with a BigInt seed;
 * - the typed ftcs-unstable refusal;
 * - philox's {execution} budget miss as an execution outcome.
 * Every accepted response is passed through the protocol's own decoder.
 * Runs under bun test and node --experimental-strip-types --test.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseU64 } from "../../experiments/identity/u64.ts";
import { decode } from "../protocol/decode.ts";
import type { RequestMessage } from "../protocol/schema.ts";
import { PINNED_ARTIFACT } from "./pinnedArtifact.ts";
import { createWasmWorkerChannel } from "./wasmWorker.ts";

let action = 0;
function request(
  parameters: RequestMessage["parameters"],
  seed = "9007199254740993",
): RequestMessage {
  action++;
  return {
    messageKind: "request",
    protocolVersion: 1,
    experimentId: "bm-01",
    instanceId: "wasm-real",
    runId: "run-1",
    actionIndex: action,
    revisions: { input: action, observer: 0, measurement: 0, estimator: 0 },
    parameters,
    modelSelection: {
      modelId: "fs-annus-diffusion",
      modelVersion: PINNED_ARTIFACT.transportVersion,
    },
    constantSetId: "modern-si-2019",
    seedPolicy: { seed: parseU64(seed), streamVersion: 1, allocationId: "bm-01.latent.v1" },
    operation: "sample",
    workBudget: { maxAllocationBytes: 1 << 24 },
  };
}

async function roundTrip(msg: RequestMessage): Promise<Record<string, unknown>> {
  const channel = await createWasmWorkerChannel();
  try {
    return await new Promise((done) => {
      channel.onmessage = (ev) => done(ev.data as Record<string, unknown>);
      channel.postMessage(msg);
    });
  } finally {
    channel.terminate?.();
  }
}

describe("wasmWorker: parameters.export runs the real module", () => {
  it("brownian_frames: an accepted response with the positions as a buffer, FrankenSim provenance, and the pinned digest", async () => {
    const req = request({
      export: "brownian_frames",
      nParticles: 4,
      steps: 16,
      stepKernel: 3,
      diffusion: 5e-13,
      dt: 0.01,
    });
    const res = await roundTrip(req);
    assert.equal(res.messageKind, "accepted", JSON.stringify(res));
    const provenance = res.provenance as Record<string, unknown>;
    assert.equal(provenance.ownerKind, "frankensim");
    assert.equal(provenance.artifactDigest, PINNED_ARTIFACT.wasmDigest);
    assert.equal(provenance.capabilityId, "diffusion.brownian-frames");
    const [header] = res.buffers as { shape: number[]; byteLength: number }[];
    assert.deepEqual(header?.shape, [4, 17]);
    const [data] = res.dataBuffers as ArrayBuffer[];
    const values = new Float64Array(data as ArrayBuffer);
    assert.equal(values.length, 68);
    assert.ok(values.every(Number.isFinite));
    assert.ok(values.some((v) => v !== 0));
    const decoded = decode(res, {
      runId: "run-1",
      acceptedActionIndex: 0,
      acceptedStepIndex: -1,
      issuedActionIndices: new Set([req.actionIndex]),
    });
    assert.equal(decoded.ok, true, JSON.stringify(decoded));
  });

  it("the seed crosses as BigInt: 2^53 and 2^53 + 1 give different positions", async () => {
    const params = {
      export: "brownian_frames",
      nParticles: 2,
      steps: 4,
      stepKernel: 3,
      diffusion: 5e-13,
      dt: 0.01,
    };
    const a = await roundTrip(request(params, "9007199254740992"));
    const b = await roundTrip(request(params, "9007199254740993"));
    const va = Array.from(new Float64Array((a.dataBuffers as ArrayBuffer[])[0] as ArrayBuffer));
    const vb = Array.from(new Float64Array((b.dataBuffers as ArrayBuffer[])[0] as ArrayBuffer));
    assert.notDeepEqual(va, vb);
  });

  it("diffusion1d_frames above the stability limit: the typed ftcs-unstable refusal", async () => {
    const res = await roundTrip(
      request({
        export: "diffusion1d_frames",
        n: 11,
        frames: 3,
        stepsPerFrame: 2,
        diffusion: 0.25,
        dx: 0.5,
        dt: 0.6,
        profile: 0,
      }),
    );
    assert.equal(res.messageKind, "refusal", JSON.stringify(res));
    assert.equal((res.refusal as { code: string }).code, "ftcs-unstable");
  });

  it("philox_normals over budget: the {execution} envelope becomes the budget-exhausted outcome", async () => {
    const res = await roundTrip(
      request({
        export: "philox_normals",
        streamKernel: 0,
        tile: 0,
        startIndex: "0",
        count: 1048577,
      }),
    );
    assert.equal(res.messageKind, "outcome", JSON.stringify(res));
    assert.equal((res.outcome as { outcome: string }).outcome, "budget-exhausted");
  });
});
