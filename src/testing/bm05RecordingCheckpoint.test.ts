import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  BM05_DEFAULTS,
  BM05_FRANKENSIM_DRAW_OWNER,
  type Bm05Parameters,
} from "../experiments/bm05/definition.ts";
import { createBm05RecordingCheckpoint } from "../experiments/bm05/recordingCheckpoint.ts";
import { scientificDigest } from "../experiments/digest/scientificDigest.ts";
import {
  FRANKENSIM_NORMAL_VERSION,
  PINNED_ARTIFACT,
} from "../experiments/provenance/pinnedFrankenSim.ts";
import type { RequestToken } from "../experiments/store/instanceStore.ts";
import type { Computation } from "../physics/reference/diffusion/ftcs.ts";
import {
  HOST_WALK_DRAW_OWNER,
  observeWalks,
  recordWalks,
  WALK_BUDGET,
  WALK_TRACE_COUNT,
  WALK_TRAJECTORY_BLOCK_POSITIONS,
  WALK_TRAJECTORY_LAYOUT,
  WALK_TRAJECTORY_SCRATCH_BYTES,
  type WalkNormalSource,
} from "../physics/reference/diffusion/walks.ts";
import { HOST_NORMAL_VERSION } from "../physics/reference/philox.ts";
import { createBm05Host } from "../workers/host/bm05Host.ts";
import { BM05_PROTOCOL, decodeLabResponse, type LabResponse } from "../workers/protocol/bm05.ts";
import { frankensimWalkNormals } from "../workers/wasm/frankensimWalkNormals.ts";
import { loadPinnedBundle } from "../workers/wasm/pinnedBundle.ts";

const sourceDigest = `source:sha256:${"c".repeat(64)}`;
const quiet = { yieldControl: async () => {} };
const parameters: Bm05Parameters = {
  ...BM05_DEFAULTS,
  walkers: 24,
  runSteps: 181,
  seed: "9007199254740993",
};

function accepted<T>(result: Computation<T>): T {
  assert.equal(result.kind, "accepted", JSON.stringify(result));
  if (result.kind !== "accepted") throw new Error("The walk was not accepted.");
  return result.data;
}

/** A planted, unplotted excursion that returns before any retained all-member checkpoint. */
function faultSource(excursion: boolean): WalkNormalSource {
  return {
    normals(_seed, walker, startStep, count) {
      const values = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        if (excursion && walker === 23 && startStep + i === 30) values[i] = 1;
        if (excursion && walker === 23 && startStep + i === 31) values[i] = -1;
      }
      return {
        kind: "accepted",
        data: { values, ownerId: HOST_WALK_DRAW_OWNER, normalVersion: HOST_NORMAL_VERSION },
      };
    },
  };
}

async function publication(p: Bm05Parameters, normals?: WalkNormalSource) {
  const token: RequestToken = {
    experimentId: "bm-05",
    instanceId: "trajectory-checkpoint",
    runId: "trajectory-run",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: p,
  };
  const responses: LabResponse[] = [];
  const host = createBm05Host(
    (message) => {
      if (message.messageKind === "result") responses.push(message);
    },
    sourceDigest,
    normals,
  );
  try {
    await host.receive({
      messageKind: "request",
      protocolVersion: BM05_PROTOCOL,
      sourceDigest,
      token,
    });
    const response = responses.at(-1);
    assert.ok(response);
    const data = accepted(response.result);
    assert.ok(data.recordingCheckpoint);
    assert.doesNotThrow(() => decodeLabResponse(response, token, sourceDigest));
    return { response, token, data, checkpoint: data.recordingCheckpoint };
  } finally {
    host.dispose();
  }
}

test("every walk has the same complete receipt across chunk budgets, selected observations, and cache eviction", async () => {
  for (const kernel of ["coin", "uniform", "gaussian"] as const) {
    const setup = { ...parameters, kernel };
    const first = accepted(await recordWalks(setup, 4, { ...quiet, chunkWork: 1 }));
    const original = await createBm05RecordingCheckpoint(first, sourceDigest);
    for (const [chunkWork, n] of [
      [257, 37],
      [65536, 0],
    ] as const) {
      const other = accepted(await recordWalks(setup, n, { ...quiet, chunkWork }));
      assert.equal(other.trajectoryDigest, first.trajectoryDigest, `${kernel}/${chunkWork}/${n}`);
      assert.deepEqual(await createBm05RecordingCheckpoint(other, sourceDigest), original);
    }
    for (let n = 30; n < 42; n++) accepted(await observeWalks(first, n, quiet));
    assert.ok(first.checkpoints.size <= 8);
    assert.equal(first.traceValues.length, WALK_TRACE_COUNT * (setup.runSteps + 1));
    assert.deepEqual(await createBm05RecordingCheckpoint(first, sourceDigest), original);
    assert.equal(original.coordinateCount, setup.walkers * (setup.runSteps + 1));
  }
});

test("canonical trajectory blocks cross walker boundaries and include the final partial block", async () => {
  const p = { ...parameters, walkers: 2, runSteps: 2050, kernel: "coin" as const };
  const recording = accepted(await recordWalks(p, 4, quiet));
  let expected = (
    await scientificDigest({
      layout: WALK_TRAJECTORY_LAYOUT,
      shape: [p.walkers, p.runSteps + 1],
      blockPositions: WALK_TRAJECTORY_BLOCK_POSITIONS,
    })
  ).digest;
  for (
    let offset = 0;
    offset < recording.traceValues.length;
    offset += WALK_TRAJECTORY_BLOCK_POSITIONS
  ) {
    expected = (
      await scientificDigest({
        previous: expected,
        offset,
        coordinates: recording.traceValues.subarray(
          offset,
          offset + WALK_TRAJECTORY_BLOCK_POSITIONS,
        ),
      })
    ).digest;
  }
  assert.equal(recording.trajectoryDigest, expected);
  const otherSeed = accepted(await recordWalks({ ...p, seed: "9007199254740992" }, 4, quiet));
  assert.notEqual(otherSeed.trajectoryDigest, recording.trajectoryDigest);
});

test("the actual host detects an unplotted walker changing only between all retained checkpoints", async () => {
  const p = { ...parameters, kernel: "gaussian" as const };
  const first = await publication(p, faultSource(false));
  const changed = await publication(p, faultSource(true));
  assert.deepEqual(
    changed.data.outputs,
    first.data.outputs,
    "All published plots and measurements agree.",
  );
  assert.notEqual(changed.checkpoint.trajectoryDigest, first.checkpoint.trajectoryDigest);
  assert.notEqual(changed.checkpoint.digest, first.checkpoint.digest);
});

test("a real pinned Gaussian owner attests its artifact and cannot be relabeled as the host", async () => {
  const loaded = await loadPinnedBundle({
    wasmUrl: resolve(
      "public/wasm",
      PINNED_ARTIFACT.bundleId,
      PINNED_ARTIFACT.hashPrefix,
      PINNED_ARTIFACT.wasmFile,
    ),
    readBytes: (path) => readFile(path),
  });
  assert.equal(loaded.kind, "loaded", loaded.kind === "refused" ? loaded.message : undefined);
  const normals = frankensimWalkNormals(loaded.exports);
  const p = { ...parameters, kernel: "gaussian" as const };
  const real = await publication(p, normals);
  assert.equal(real.checkpoint.ownerId, BM05_FRANKENSIM_DRAW_OWNER);
  assert.equal(real.checkpoint.normalVersion, FRANKENSIM_NORMAL_VERSION);
  assert.equal(real.checkpoint.artifactDigest, `sha256:${PINNED_ARTIFACT.wasmDigest}`);
  // Deliberately preserve every float while falsifying its producer, to prove identity is bound.
  const relabeled: WalkNormalSource = {
    normals(...args) {
      const draws = normals.normals(...args);
      return draws.kind !== "accepted"
        ? draws
        : {
            kind: "accepted",
            data: {
              ...draws.data,
              ownerId: HOST_WALK_DRAW_OWNER,
              normalVersion: HOST_NORMAL_VERSION,
            },
          };
    },
  };
  const falseOwner = await publication(p, relabeled);
  assert.equal(falseOwner.checkpoint.trajectoryDigest, real.checkpoint.trajectoryDigest);
  assert.notEqual(falseOwner.checkpoint.digest, real.checkpoint.digest);
  assert.equal(falseOwner.checkpoint.artifactDigest, sourceDigest);
});

test("the protocol binds every receipt field and parent run before publication", async () => {
  const { response, token, checkpoint } = await publication(parameters);
  for (const [field, value] of Object.entries(checkpoint)) {
    const changed = structuredClone(response);
    const data = accepted(changed.result);
    assert.ok(data.recordingCheckpoint);
    const bad = typeof value === "number" ? value + 1 : `${value}:changed`;
    Object.assign(data.recordingCheckpoint, { [field]: bad });
    assert.throws(
      () => decodeLabResponse(changed, token, sourceDigest),
      /checkpoint|protocol fields/,
      field,
    );
  }
  const extra = structuredClone(response);
  Object.assign(accepted(extra.result).recordingCheckpoint ?? {}, { truncated: 1 });
  assert.throws(() => decodeLabResponse(extra, token, sourceDigest), /protocol fields/);
  const parent = { ...response, token: { ...token, parentRunId: "another-trial" } };
  assert.throws(() => decodeLabResponse(parent, token, sourceDigest), /echo/);
  // Old prepared examples remain readable; lacking a live receipt will not earn retirement.
  const legacy = structuredClone(response);
  const { recordingCheckpoint: _receipt, ...data } = accepted(legacy.result);
  assert.doesNotThrow(() =>
    decodeLabResponse({ ...legacy, result: { kind: "accepted", data } }, token, sourceDigest),
  );
});

test("draw version changes never mix within a recording or an uncached observation", async () => {
  const zero = faultSource(false);
  const mixed: WalkNormalSource = {
    normals(...args) {
      const drawn = accepted(zero.normals(...args));
      return {
        kind: "accepted",
        data: { ...drawn, normalVersion: args[1] === 0 ? HOST_NORMAL_VERSION : "changed" },
      };
    },
  };
  const p = { ...parameters, kernel: "gaussian" as const };
  const refused = await recordWalks(p, 4, { ...quiet, normals: mixed });
  assert.equal(refused.kind, "outcome");
  if (refused.kind === "outcome") assert.equal(refused.outcome.outcome, "invariant-violation");
  let changed = false;
  const mutable: WalkNormalSource = {
    normals(...args) {
      const drawn = accepted(zero.normals(...args));
      return {
        kind: "accepted",
        data: { ...drawn, normalVersion: changed ? "changed" : HOST_NORMAL_VERSION },
      };
    },
  };
  const recording = accepted(await recordWalks(p, 4, { ...quiet, normals: mutable }));
  const size = recording.checkpoints.size;
  changed = true;
  const observed = await observeWalks(recording, 37, quiet);
  assert.equal(observed.kind, "outcome");
  if (observed.kind === "outcome") assert.equal(observed.outcome.outcome, "invariant-violation");
  assert.equal(recording.checkpoints.size, size);
  assert.equal(recording.checkpoints.has(37), false);
});

test("admission charges fixed hashing and Gaussian scratch, and cancellation publishes no partial receipt", async () => {
  let called = false;
  const p = { ...parameters, kernel: "gaussian" as const, walkers: 10000, runSteps: 10000 };
  const result = await recordWalks(p, 4, {
    ...quiet,
    normals: {
      normals() {
        called = true;
        throw new Error("Over-budget draws must not run.");
      },
    },
  });
  assert.equal(result.kind, "outcome");
  if (result.kind !== "outcome" || result.outcome.outcome !== "budget-exhausted")
    throw new Error("Missing budget refusal.");
  assert.equal(result.outcome.allowed.workUnits, WALK_BUDGET.workUnits);
  assert.equal(
    result.outcome.requested.allocationBytes,
    (WALK_TRACE_COUNT * (p.runSteps + 1) + p.walkers * 12 + p.runSteps * 4) * 8 +
      WALK_TRAJECTORY_SCRATCH_BYTES,
  );
  assert.equal(called, false);
  let stopped = false;
  const cancelled = await recordWalks(parameters, 4, {
    chunkWork: 257,
    cancelled: () => stopped,
    yieldControl: async () => {
      stopped = true;
    },
  });
  assert.equal(cancelled.kind, "outcome");
  if (cancelled.kind === "outcome") assert.equal(cancelled.outcome.outcome, "cancelled");
});
