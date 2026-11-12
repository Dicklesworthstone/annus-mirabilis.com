import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test, { type TestContext } from "node:test";
import type { Bm01Parameters } from "../experiments/bm01/definition.ts";
import { createBm01Session, type PreparedBm01Example } from "../experiments/bm01/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import type { AcceptedSnapshot, RequestToken } from "../experiments/store/instanceStore.ts";
import prepared from "../generated/bm01-example.json";
import { createBm01Host } from "../workers/host/bm01Host.ts";
import { type Bm01Recorder, HOST_TRACER_RECORDER } from "../workers/operations/bm01.ts";
import type { LabHello, LabResponse } from "../workers/protocol/bm01.ts";
import { createWorkerAdmission, type WorkerAdmission } from "../workers/scheduler/admission.ts";
import {
  createWorkerRetention,
  type WorkerRetention,
  WorkerRetentionConfigurationError,
} from "../workers/scheduler/retention.ts";
import type { WorkerChannel } from "../workers/scheduler/scheduler.ts";
import { frankensimTracerRecorder } from "../workers/wasm/frankensimTracerRecorder.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";
import { loadPinnedBundle } from "../workers/wasm/pinnedBundle.ts";

const example = prepared as PreparedBm01Example;
const parameters: Bm01Parameters = {
  ...example.parameters,
  M: 4,
  H: 1,
  interval: 0.2,
  seed: "9007199254740993",
};

async function until(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(condition(), "The actual worker/session did not reach its expected state.");
}

function encoded(snapshot: AcceptedSnapshot, scientificOnly = false): readonly string[] {
  return snapshot.outputs
    .filter((output) => !scientificOnly || output.quantityId !== "reusedRecording")
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

/** Actual owner calculations and protocol validation, with controlled transport delivery only. */
function laboratory(
  t: TestContext,
  id: string,
  admission: WorkerAdmission,
  retention: WorkerRetention,
) {
  const control = {
    recorder: HOST_TRACER_RECORDER as Bm01Recorder,
    holdHello: false,
    holdResults: false,
    omitCheckpoint: false,
    corruptCheckpoint: false,
    duplicateCheckpoint: false,
  };
  const workers: {
    disposed: boolean;
    hello(): void;
    release(): void;
  }[] = [];
  const responses: LabResponse[] = [];
  const requests: RequestToken[] = [];
  const factory = (): WorkerChannel => {
    let onMessage: ((message: unknown) => void) | undefined;
    let onError: (() => void) | undefined;
    const held: LabResponse[] = [];
    const worker = {
      disposed: false,
      hello: () => host.hello(),
      release() {
        for (const message of held.splice(0)) onMessage?.(message);
      },
    };
    const host = createBm01Host(
      (message: LabHello | LabResponse) => {
        if (worker.disposed) return;
        let copy = structuredClone(message);
        if (copy.messageKind === "result") {
          if (copy.result.kind === "accepted") {
            const { recordingCheckpoint, ...data } = copy.result.data;
            copy = {
              ...copy,
              result: {
                kind: "accepted",
                data: {
                  ...data,
                  ...(!control.omitCheckpoint && recordingCheckpoint
                    ? {
                        recordingCheckpoint: control.corruptCheckpoint
                          ? { ...recordingCheckpoint, digest: "host:sha256:" + "f".repeat(64) }
                          : recordingCheckpoint,
                      }
                    : {}),
                },
              },
            };
          }
          responses.push(copy);
          if (control.holdResults) {
            held.push(copy);
            return;
          }
        }
        onMessage?.(copy);
        if (
          control.duplicateCheckpoint &&
          copy.messageKind === "result" &&
          copy.result.kind === "accepted" &&
          copy.result.data.recordingCheckpoint
        )
          onMessage?.({
            ...copy,
            result: {
              ...copy.result,
              data: {
                ...copy.result.data,
                recordingCheckpoint: {
                  ...copy.result.data.recordingCheckpoint,
                  digest: "host:sha256:" + "e".repeat(64),
                },
              },
            },
          });
      },
      example.sourceDigest,
      control.recorder,
    );
    workers.push(worker);
    return {
      send(message) {
        const request = message as { messageKind: string; token?: RequestToken };
        if (request.messageKind === "request" && request.token) requests.push(request.token);
        void host.receive(structuredClone(message)).catch(() => onError?.());
      },
      listen(receive, failed) {
        onMessage = receive;
        onError = failed;
        if (!control.holdHello) queueMicrotask(() => worker.hello());
        return () => {
          onMessage = undefined;
          onError = undefined;
        };
      },
      dispose() {
        worker.disposed = true;
        host.dispose();
      },
    };
  };
  const session = createBm01Session(id, example, factory, { admission, retention });
  t.after(() => session.disconnect());
  return { session, workers, responses, requests, control };
}
type Laboratory = ReturnType<typeof laboratory>;

async function applyAccepted(lab: Laboratory, input: Bm01Parameters = parameters) {
  const request = lab.session.apply(input);
  assert.equal(request.kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  const view = lab.session.getSnapshot();
  assert.equal(view.status, "accepted", JSON.stringify(view.outcome ?? view.refusal));
  assert.ok(view.accepted);
  return view.accepted;
}

function checkpoint(lab: Laboratory) {
  const response = lab.responses.at(-1);
  assert.equal(response?.result.kind, "accepted");
  if (response?.result.kind !== "accepted") throw new Error("Missing actual recording.");
  assert.ok(response.result.data.recordingCheckpoint);
  return response.result.data.recordingCheckpoint;
}

for (const capacity of [1, 2]) {
  test("BM01 reclaims least-recently-used idle workers at capacity " + capacity, async (t) => {
    const admission = createWorkerAdmission(2);
    const retention = createWorkerRetention(capacity);
    const first = laboratory(t, "lru-first-" + capacity, admission, retention);
    const initial = await applyAccepted(first);
    const original = checkpoint(first);
    const peers = Array.from({ length: capacity }, (_, index) =>
      laboratory(t, "lru-peer-" + capacity + "-" + index, admission, retention),
    );
    for (const peer of peers) await applyAccepted(peer);
    assert.equal(first.workers[0]?.disposed, true);
    assert.equal(first.session.getSnapshot().accepted, initial);
    assert.equal(retention.size, capacity);
    assert.equal(admission.activeCount, 0);

    const observation = { ...parameters, interval: 0.4, axis: 1 };
    const recovered = await applyAccepted(first, observation);
    assert.equal(first.workers.length, 2);
    assert.equal(recovered.runId, initial.runId);
    assert.equal(recovered.parameters.seed, "9007199254740993");
    assert.equal(recovered.simulationTime, initial.simulationTime);
    assert.equal(recovered.stepIndex, initial.stepIndex);
    assert.deepEqual(checkpoint(first), original);

    const uninterrupted = laboratory(
      t,
      "lru-control-" + capacity,
      createWorkerAdmission(1),
      createWorkerRetention(1),
    );
    await applyAccepted(uninterrupted);
    const control = await applyAccepted(uninterrupted, observation);
    assert.deepEqual(encoded(recovered, true), encoded(control, true));
    assert.equal(retention.size, capacity);
  });
}

test("active calculations and restarted handshakes cannot be selected for idle eviction", async (t) => {
  const admission = createWorkerAdmission(2);
  const retention = createWorkerRetention(1);
  const first = laboratory(t, "lru-active", admission, retention);
  const peer = laboratory(t, "lru-active-peer", admission, retention);
  const third = laboratory(t, "lru-active-third", admission, retention);
  await applyAccepted(first);
  first.control.holdResults = true;
  first.session.apply({ ...parameters, interval: 0.4 });
  await until(() => first.responses.length === 2);
  await applyAccepted(peer);
  await applyAccepted(third);
  assert.equal(peer.workers[0]?.disposed, true);
  assert.equal(first.workers[0]?.disposed, false, "A withheld active result retains its worker.");
  assert.equal(first.session.getSnapshot().pending, true);
  assert.equal(admission.activeCount, 1);
  first.control.holdResults = false;
  first.workers[0]?.release();
  await until(() => !first.session.getSnapshot().pending);
  assert.equal(first.session.getSnapshot().status, "accepted");

  await applyAccepted(peer, { ...parameters, interval: 0.4 });
  assert.equal(first.workers[0]?.disposed, true);
  first.control.holdHello = true;
  first.session.apply({ ...parameters, interval: 0.6 });
  assert.equal(first.workers.length, 2);
  await applyAccepted(third, { ...parameters, interval: 0.4 });
  assert.equal(first.workers[1]?.disposed, false, "A new worker's handshake is not an idle cache.");
  assert.equal(admission.activeCount, 1);
  first.control.holdHello = false;
  first.workers[1]?.hello();
  await until(() => !first.session.getSnapshot().pending);
  assert.equal(first.session.getSnapshot().status, "accepted");
  assert.equal(first.session.getSnapshot().accepted?.parameters.interval, 0.6);
});

test("hidden pending changes retain the exact token, seed and accepted result across retirement", async (t) => {
  const admission = createWorkerAdmission(1);
  const retention = createWorkerRetention(1);
  const first = laboratory(t, "lru-hidden", admission, retention);
  const peer = laboratory(t, "lru-hidden-peer", admission, retention);
  const initial = await applyAccepted(first);
  const original = checkpoint(first);
  first.session.setSchedulingPaused(true);
  first.session.apply({ ...parameters, interval: 0.4 });
  first.session.apply({ ...parameters, interval: 0.6, axis: 1 });
  const pending = first.session.getSnapshot().requested;
  await applyAccepted(peer);
  assert.equal(first.workers[0]?.disposed, true);
  assert.equal(first.workers.length, 1);
  assert.equal(first.requests.length, 1);
  assert.equal(first.session.getSchedulingPaused(), true);
  assert.equal(first.session.getSnapshot().requested, pending);
  assert.equal(first.session.getSnapshot().accepted, initial);

  first.session.setSchedulingPaused(false);
  await until(() => !first.session.getSnapshot().pending);
  assert.equal(first.session.getSnapshot().status, "accepted");
  assert.equal(first.session.getSnapshot().requested, pending);
  assert.equal(first.session.getSnapshot().accepted?.actionIndex, pending?.actionIndex);
  assert.equal(first.session.getSnapshot().accepted?.runId, initial.runId);
  assert.equal(first.session.getSnapshot().accepted?.parameters.seed, parameters.seed);
  assert.deepEqual(checkpoint(first), original);
  assert.equal(first.workers.length, 2);
});

test("a reconstructed worker cannot silently switch the actual WASM recorder to the host engine", async (t) => {
  const wasmPath = resolve(
    "public/wasm",
    PINNED_ARTIFACT.bundleId,
    PINNED_ARTIFACT.hashPrefix,
    PINNED_ARTIFACT.wasmFile,
  );
  const loaded = await loadPinnedBundle({ wasmUrl: wasmPath, readBytes: (path) => readFile(path) });
  assert.equal(loaded.kind, "loaded");
  if (loaded.kind !== "loaded") throw new Error("Pinned WASM recorder did not load.");
  const lab = laboratory(t, "lru-engine", createWorkerAdmission(1), createWorkerRetention(0));
  lab.control.recorder = frankensimTracerRecorder(loaded.exports);
  const initial = await applyAccepted(lab);
  const before = encoded(initial);
  const original = checkpoint(lab);
  assert.equal(lab.workers[0]?.disposed, true);

  lab.control.recorder = HOST_TRACER_RECORDER;
  lab.session.apply({ ...parameters, interval: 0.4 });
  await until(() => !lab.session.getSnapshot().pending);
  const refused = lab.session.getSnapshot();
  assert.equal(refused.status, "unavailable");
  assert.equal(refused.outcome?.outcome, "invariant-violation");
  assert.match(String(refused.outcome?.details?.checkpointNotice), /Start a new independent trial/);
  assert.equal(refused.accepted, initial);
  assert.deepEqual(
    encoded(initial),
    before,
    "All accepted arrays remain available to the result codec.",
  );
  assert.notEqual(checkpoint(lab).ownerId, original.ownerId);

  const next = lab.session.startNewRun({ ...parameters, interval: 0.4 });
  assert.equal(next.kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  const recovered = lab.session.getSnapshot();
  assert.equal(recovered.status, "accepted");
  assert.notEqual(recovered.accepted?.runId, initial.runId);
  assert.equal(recovered.accepted?.parameters.seed, parameters.seed);
  assert.equal(checkpoint(lab).ownerId, HOST_TRACER_RECORDER.ownerId);
});

test("a valid-format changed latent digest is refused before accepted output publication", async (t) => {
  const lab = laboratory(t, "lru-digest", createWorkerAdmission(1), createWorkerRetention(0));
  const initial = await applyAccepted(lab);
  const before = encoded(initial);
  lab.control.corruptCheckpoint = true;
  lab.session.apply({ ...parameters, interval: 0.4 });
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "unavailable");
  assert.equal(lab.session.getSnapshot().outcome?.outcome, "invariant-violation");
  assert.equal(lab.session.getSnapshot().accepted, initial);
  assert.deepEqual(encoded(initial), before);
});

test("a worker without a complete accepted checkpoint stays pinned and remains usable", async (t) => {
  const retention = createWorkerRetention(0);
  const lab = laboratory(t, "lru-no-proof", createWorkerAdmission(1), retention);
  lab.control.omitCheckpoint = true;
  const initial = await applyAccepted(lab);
  assert.equal(lab.workers[0]?.disposed, false);
  assert.equal(retention.size, 0);
  const next = await applyAccepted(lab, { ...parameters, interval: 0.4 });
  assert.equal(next.runId, initial.runId);
  assert.equal(lab.workers.length, 1);
  assert.equal(lab.workers[0]?.disposed, false);
});

test("a cancelled asynchronous verifier cannot replace a later run's accepted continuity", async (t) => {
  const lab = laboratory(
    t,
    "lru-late-verifier",
    createWorkerAdmission(1),
    createWorkerRetention(0),
  );
  let started = false;
  let release: ((notice: string | null) => void) | undefined;
  const blocked = new Promise<string | null>((resolve) => {
    release = resolve;
  });
  lab.session.applyVerified(parameters, async () => {
    started = true;
    return blocked;
  });
  await until(() => started);
  lab.session.stop();
  lab.session.startNewRun({ ...parameters, seed: "9007199254740995" });
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "accepted");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted);
  release?.(null);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(lab.session.getSnapshot().accepted, accepted);
  const resumed = await applyAccepted(lab, {
    ...parameters,
    seed: "9007199254740995",
    interval: 0.4,
  });
  assert.equal(resumed.runId, accepted.runId);
});

test("retention touches and withdrawals preserve LRU order despite reentrant failing cleanup", () => {
  const pool = createWorkerRetention(1);
  const first = {},
    second = {},
    third = {},
    fourth = {};
  const retired: string[] = [];
  pool.retain(first, () => retired.push("old-first"));
  pool.retain(first, () => {
    retired.push("first");
    pool.retain(third, () => retired.push("third"));
    throw new Error("Cleanup failure must not strand another owner.");
  });
  pool.retain(second, () => retired.push("second"));
  assert.deepEqual(retired, ["first", "second"]);
  assert.equal(pool.size, 1);
  pool.release(third);
  pool.retain(fourth, () => retired.push("fourth"));
  assert.deepEqual(retired, ["first", "second"]);
  assert.equal(pool.size, 1);
  for (const limit of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(
      () => createWorkerRetention(limit),
      (error: unknown) => {
        assert.ok(error instanceof WorkerRetentionConfigurationError);
        assert.equal(error.code, "invalid-worker-retention-limit");
        return true;
      },
    );
});

test("duplicate accepted packets cannot replace the checkpoint belonging to the published result", async (t) => {
  const lab = laboratory(t, "lru-duplicate", createWorkerAdmission(1), createWorkerRetention(0));
  lab.control.duplicateCheckpoint = true;
  const initial = await applyAccepted(lab);
  const original = checkpoint(lab);
  lab.control.duplicateCheckpoint = false;
  const resumed = await applyAccepted(lab, { ...parameters, interval: 0.4 });
  assert.equal(resumed.runId, initial.runId);
  assert.deepEqual(checkpoint(lab), original);
});
