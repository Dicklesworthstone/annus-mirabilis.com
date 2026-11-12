import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test, { type TestContext } from "node:test";
import type { Bm05Parameters } from "../experiments/bm05/definition.ts";
import { createBm05Session, type PreparedBm05Example } from "../experiments/bm05/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import prepared from "../generated/bm05-example.json";
import {
  HOST_WALK_DRAW_OWNER,
  HOST_WALK_NORMALS,
  type WalkNormalSource,
} from "../physics/reference/diffusion/walks.ts";
import { HOST_NORMAL_VERSION } from "../physics/reference/philox.ts";
import { createBm05Host } from "../workers/host/bm05Host.ts";
import type { LabResponse } from "../workers/protocol/bm05.ts";
import { createWorkerAdmission, type WorkerAdmission } from "../workers/scheduler/admission.ts";
import { createWorkerRetention, type WorkerRetention } from "../workers/scheduler/retention.ts";
import type { WorkerChannel } from "../workers/scheduler/scheduler.ts";
import { frankensimWalkNormals } from "../workers/wasm/frankensimWalkNormals.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";
import { loadPinnedBundle } from "../workers/wasm/pinnedBundle.ts";

const example = prepared as PreparedBm05Example;
const parameters: Bm05Parameters = {
  ...example.parameters,
  seed: "9007199254740993",
  walkers: 24,
  runSteps: 181,
};
const executionCounters = new Set([
  "requestDraws",
  "replayedDraws",
  "reusedRecording",
  "retainedBytes",
]);

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(condition(), "The walk owner did not reach the expected state.");
}

function science(snapshot: AcceptedSnapshot, includeCounters = false): readonly string[] {
  return snapshot.outputs
    .filter((output) => includeCounters || !executionCounters.has(output.quantityId))
    .map((output) => {
      const result: ScientificResult =
        output.status === "value"
          ? {
              ...output,
              value: typeof output.value === "number" ? output.value : output.value.copy(),
            }
          : output;
      return encodeResult(result);
    });
}

function laboratory(
  t: TestContext,
  id: string,
  retention: WorkerRetention | null,
  admission: WorkerAdmission = createWorkerAdmission(1),
) {
  const control: { normals: WalkNormalSource; omit: boolean; hold: Promise<void> | null } = {
    normals: HOST_WALK_NORMALS,
    omit: false,
    hold: null,
  };
  const workers: { disposed: boolean }[] = [];
  const responses: LabResponse[] = [];
  const factory = (): WorkerChannel => {
    let receive: ((message: unknown) => void) | undefined;
    let failed: (() => void) | undefined;
    const worker = { disposed: false };
    const host = createBm05Host(
      (message) => {
        if (worker.disposed) return;
        let packet = structuredClone(message);
        if (packet.messageKind === "result") {
          if (packet.result.kind === "accepted" && control.omit) {
            const { recordingCheckpoint: _receipt, ...data } = packet.result.data;
            packet = { ...packet, result: { kind: "accepted", data } };
          }
          responses.push(packet);
        }
        receive?.(packet);
      },
      example.sourceDigest,
      control.normals,
    );
    workers.push(worker);
    return {
      send(message) {
        void (async () => {
          if (control.hold) await control.hold;
          if (!worker.disposed) await host.receive(structuredClone(message));
        })().catch(() => failed?.());
      },
      listen(onMessage, onError) {
        receive = onMessage;
        failed = onError;
        queueMicrotask(() => host.hello());
        return () => {
          receive = undefined;
          failed = undefined;
        };
      },
      dispose() {
        worker.disposed = true;
        host.dispose();
      },
    };
  };
  const session = createBm05Session(id, example, factory, { admission, retention });
  t.after(() => session.disconnect());
  return { session, workers, responses, control };
}
type Laboratory = ReturnType<typeof laboratory>;

async function applyAccepted(lab: Laboratory, input: Bm05Parameters) {
  assert.equal(lab.session.apply(input).kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  const view = lab.session.getSnapshot();
  assert.equal(view.status, "accepted", JSON.stringify(view.outcome ?? view.refusal));
  assert.ok(view.accepted);
  return view.accepted;
}

function checkpoint(lab: Laboratory) {
  const response = lab.responses.at(-1);
  assert.equal(response?.result.kind, "accepted");
  if (response?.result.kind !== "accepted") throw new Error("Missing walk publication.");
  assert.ok(response.result.data.recordingCheckpoint);
  return response.result.data.recordingCheckpoint;
}

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

test("coin, uniform and Gaussian observations survive repeated retirement without changing the trial", async (t) => {
  for (const kernel of ["coin", "uniform", "gaussian"] as const) {
    const cold = laboratory(t, `walk-cold-${kernel}`, createWorkerRetention(0));
    const warm = laboratory(t, `walk-warm-${kernel}`, createWorkerRetention(1));
    let original: ReturnType<typeof checkpoint> | undefined;
    let runId: string | undefined;
    for (const [n, bias] of [
      [4, 0.6],
      [37, 0.6],
      [181, 0.5],
      [0, 0.5],
      [16, 0.7],
      [37, 0.5],
    ] as const) {
      const p = { ...parameters, kernel, n, bias };
      const recovered = await applyAccepted(cold, p);
      const uninterrupted = await applyAccepted(warm, p);
      original ??= checkpoint(cold);
      runId ??= recovered.runId;
      assert.equal(recovered.runId, runId);
      assert.deepEqual(checkpoint(cold), original);
      assert.deepEqual(checkpoint(warm), original);
      assert.deepEqual(science(recovered), science(uninterrupted), `${kernel}/${n}/${bias}`);
      assert.equal(recovered.stepIndex, uninterrupted.stepIndex);
      assert.equal(recovered.simulationTime, uninterrupted.simulationTime);
      assert.equal(cold.workers.at(-1)?.disposed, true);
    }
    assert.equal(cold.workers.length, 6);
    assert.equal(warm.workers.length, 1);
  }
});

test("a hidden walk keeps its exact pending observation token through peer LRU retirement", async (t) => {
  const retention = createWorkerRetention(1);
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, "walk-hidden", retention, admission);
  const peer = laboratory(t, "walk-peer", retention, admission);
  const accepted = await applyAccepted(first, parameters);
  const original = checkpoint(first);
  const saved = science(accepted, true);
  first.session.setSchedulingPaused(true);
  first.session.apply({ ...parameters, n: 37, bias: 0.5 });
  const requested = first.session.getSnapshot().requested;
  await applyAccepted(peer, parameters);
  assert.equal(first.workers[0]?.disposed, true);
  assert.equal(first.session.getSnapshot().accepted, accepted);
  assert.equal(first.session.getSnapshot().requested, requested);
  assert.deepEqual(science(accepted, true), saved);
  first.session.setSchedulingPaused(false);
  await until(() => !first.session.getSnapshot().pending);
  const view = first.session.getSnapshot();
  assert.equal(view.status, "accepted");
  assert.equal(view.requested, requested);
  assert.equal(view.accepted?.runId, accepted.runId);
  assert.equal(view.accepted?.parameters.n, 37);
  assert.equal(view.accepted?.parameters.bias, 0.5);
  assert.deepEqual(checkpoint(first), original);
  assert.equal(first.workers.length, 2);
});

test("an invisible changed path cannot replace accepted data; explicit recovery starts a new recording", async (t) => {
  const lab = laboratory(t, "walk-invisible-change", createWorkerRetention(0));
  lab.control.normals = faultSource(false);
  const p = { ...parameters, kernel: "gaussian" as const };
  const accepted = await applyAccepted(lab, p);
  const saved = science(accepted, true);
  const original = checkpoint(lab);
  lab.control.normals = faultSource(true);
  lab.session.apply({ ...p, n: 37, bias: 0.5 });
  await until(() => !lab.session.getSnapshot().pending);
  const failure = lab.session.getSnapshot();
  assert.equal(failure.status, "unavailable");
  assert.equal(failure.outcome?.outcome, "invariant-violation");
  assert.match(String(failure.outcome?.details?.checkpointNotice), /complete trajectory differs/);
  assert.equal(failure.accepted, accepted);
  assert.deepEqual(science(accepted, true), saved);
  assert.notEqual(checkpoint(lab).trajectoryDigest, original.trajectoryDigest);
  assert.equal(lab.session.startNewRun(failure.requested?.parameters).kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  const recovered = lab.session.getSnapshot();
  assert.equal(recovered.status, "accepted");
  assert.notEqual(recovered.accepted?.runId, accepted.runId);
  assert.equal(recovered.accepted?.parameters.n, 37);
  assert.equal(recovered.accepted?.parameters.bias, 0.5);
  assert.equal(recovered.accepted?.parameters.seed, p.seed);
});

test("real pinned Gaussian recovery verifies the engine even when every position is bitwise equal", async (t) => {
  const loaded = await loadPinnedBundle({
    wasmUrl: resolve(
      "public/wasm",
      PINNED_ARTIFACT.bundleId,
      PINNED_ARTIFACT.hashPrefix,
      PINNED_ARTIFACT.wasmFile,
    ),
    readBytes: (path) => readFile(path),
  });
  assert.equal(loaded.kind, "loaded");
  if (loaded.kind !== "loaded") throw new Error(loaded.message);
  const normals = frankensimWalkNormals(loaded.exports);
  const lab = laboratory(t, "walk-engine-change", createWorkerRetention(0));
  lab.control.normals = normals;
  const p = { ...parameters, kernel: "gaussian" as const };
  const first = await applyAccepted(lab, p);
  const original = checkpoint(lab);
  const observed = await applyAccepted(lab, { ...p, n: 37 });
  assert.equal(observed.runId, first.runId);
  assert.deepEqual(checkpoint(lab), original);
  const saved = science(observed, true);
  lab.control.normals = {
    normals(...args) {
      const drawn = normals.normals(...args);
      return drawn.kind !== "accepted"
        ? drawn
        : {
            kind: "accepted",
            data: {
              ...drawn.data,
              ownerId: HOST_WALK_DRAW_OWNER,
              normalVersion: HOST_NORMAL_VERSION,
            },
          };
    },
  };
  lab.session.apply({ ...p, n: 64 });
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "unavailable");
  assert.equal(lab.session.getSnapshot().accepted, observed);
  assert.equal(checkpoint(lab).trajectoryDigest, original.trajectoryDigest);
  assert.notEqual(checkpoint(lab).digest, original.digest);
  assert.deepEqual(science(observed, true), saved);
  assert.equal(lab.session.startNewRun({ ...p, n: 64 }).kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "accepted");
  assert.notEqual(lab.session.getSnapshot().accepted?.runId, first.runId);
  assert.equal(checkpoint(lab).ownerId, HOST_WALK_DRAW_OWNER);
});

test("a receipt is required for retirement and cannot disappear after it has been trusted", async (t) => {
  const lab = laboratory(t, "walk-without-proof", createWorkerRetention(0));
  lab.control.omit = true;
  const first = await applyAccepted(lab, parameters);
  assert.equal(lab.workers[0]?.disposed, false);
  const second = await applyAccepted(lab, { ...parameters, n: 37 });
  assert.equal(second.runId, first.runId);
  assert.equal(lab.workers.length, 1);
  lab.control.omit = false;
  const attested = await applyAccepted(lab, { ...parameters, n: 64 });
  assert.equal(lab.workers[0]?.disposed, true);
  lab.control.omit = true;
  lab.session.apply({ ...parameters, n: 16 });
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "unavailable");
  assert.equal(lab.session.getSnapshot().accepted, attested);
  assert.match(
    String(lab.session.getSnapshot().outcome?.details?.checkpointNotice),
    /could not verify the saved recording/,
  );
});

test("active work stays admitted, and explicit retention opt-out keeps its owner pinned", async (t) => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory(t, "walk-active", createWorkerRetention(0), admission);
  await applyAccepted(lab, parameters);
  let release: (() => void) | undefined;
  lab.control.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  lab.session.apply({ ...parameters, n: 37 });
  await until(() => lab.workers.length === 2);
  assert.equal(lab.session.getSnapshot().pending, true);
  assert.equal(lab.workers[1]?.disposed, false);
  assert.equal(admission.activeCount, 1);
  release?.();
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "accepted");
  assert.equal(lab.workers[1]?.disposed, true);
  assert.equal(admission.activeCount, 0);
  const pinned = laboratory(t, "walk-pinned", null);
  const first = await applyAccepted(pinned, parameters);
  const next = await applyAccepted(pinned, { ...parameters, n: 37 });
  assert.equal(next.runId, first.runId);
  assert.equal(pinned.workers.length, 1);
  assert.equal(pinned.workers[0]?.disposed, false);
  pinned.session.disconnect();
  assert.equal(pinned.workers[0]?.disposed, true);
});

test("a failed additional scientific verifier never trusts a candidate recording", async (t) => {
  const lab = laboratory(t, "walk-verifier", createWorkerRetention(0));
  const initial = lab.session.getSnapshot().accepted;
  let verified = 0;
  assert.equal(
    lab.session.applyVerified(parameters, async (publication) => {
      assert.ok(publication.recordingCheckpoint);
      verified++;
      return "The selected tape checkpoint does not agree.";
    }).kind,
    "accepted",
  );
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(verified, 1);
  assert.equal(lab.session.getSnapshot().status, "unavailable");
  assert.equal(lab.session.getSnapshot().accepted, initial);
  assert.equal(lab.workers[0]?.disposed, false);
  await applyAccepted(lab, parameters);
  assert.equal(lab.workers[0]?.disposed, true);
});

test("reentrant recovery cannot apply its remaining controls to a newer requested trial", async (t) => {
  const lab = laboratory(t, "walk-reentrant", createWorkerRetention(0));
  const accepted = await applyAccepted(lab, parameters);
  const inner = { ...parameters, seed: "1907", n: 16, bias: 0.4 };
  let fired = false;
  const unsubscribe = lab.session.subscribe(() => {
    if (fired || lab.session.getSnapshot().requested?.runId === accepted.runId) return;
    fired = true;
    lab.session.apply(inner);
  });
  const outer = lab.session.startNewRun({ ...parameters, n: 37, bias: 0.5 });
  unsubscribe();
  assert.equal(outer.kind, "outcome");
  if (outer.kind === "outcome") assert.equal(outer.outcome.outcome, "superseded");
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "accepted");
  assert.deepEqual(lab.session.getSnapshot().accepted?.parameters, inner);
});
