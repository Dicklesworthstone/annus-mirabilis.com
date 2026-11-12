import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Bm08Parameters } from "../experiments/bm08/definition.ts";
import { cameraObservationCsv } from "../experiments/bm08/export.ts";
import { createBm08Session, type PreparedBm08Example } from "../experiments/bm08/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import prepared from "../generated/bm08-example.json";
import { createBm08Host } from "../workers/host/bm08Host.ts";
import type { LabResponse } from "../workers/protocol/bm08.ts";
import { createWorkerAdmission, type WorkerAdmission } from "../workers/scheduler/admission.ts";
import { createWorkerRetention, type WorkerRetention } from "../workers/scheduler/retention.ts";
import type { WorkerChannel } from "../workers/scheduler/scheduler.ts";

const example = prepared as PreparedBm08Example;
const parameters: Bm08Parameters = {
  ...example.parameters,
  seed: "9007199254740993",
  noiseSeed: "9007199254740995",
  clickSeed: "9007199254740997",
  M: 6,
  clicks: 5,
  coverageTrials: 0,
};
const executionCounters = new Set([
  "requestDraws",
  "measurementDraws",
  "reusedRecording",
  "reusedObservation",
  "retainedBytes",
]);

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(condition(), "The camera owner did not reach the expected state.");
}

function science(snapshot: AcceptedSnapshot): readonly string[] {
  return snapshot.outputs
    .filter((output) => !executionCounters.has(output.quantityId))
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
  retention: WorkerRetention,
  admission: WorkerAdmission = createWorkerAdmission(1),
) {
  const control = { corrupt: false, omit: false };
  const workers: { disposed: boolean }[] = [];
  const responses: LabResponse[] = [];
  const factory = (): WorkerChannel => {
    let receive: ((message: unknown) => void) | undefined;
    let failed: (() => void) | undefined;
    const worker = { disposed: false };
    const host = createBm08Host((message) => {
      if (worker.disposed) return;
      let packet = structuredClone(message);
      if (packet.messageKind === "result" && packet.result.kind === "accepted") {
        const { recordingCheckpoint, ...data } = packet.result.data;
        packet = {
          ...packet,
          result: {
            kind: "accepted",
            data: {
              ...data,
              ...(!control.omit && recordingCheckpoint
                ? {
                    recordingCheckpoint: control.corrupt
                      ? { ...recordingCheckpoint, digest: "host:sha256:" + "f".repeat(64) }
                      : recordingCheckpoint,
                  }
                : {}),
            },
          },
        };
      }
      if (packet.messageKind === "result") responses.push(packet);
      receive?.(packet);
    }, example.sourceDigest);
    workers.push(worker);
    return {
      send(message) {
        void host.receive(structuredClone(message)).catch(() => failed?.());
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
  const session = createBm08Session(id, example, factory, { admission, retention });
  t.after(() => session.disconnect());
  return { session, workers, responses, control };
}
type Laboratory = ReturnType<typeof laboratory>;

async function applyAccepted(lab: Laboratory, input: Bm08Parameters) {
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
  if (response?.result.kind !== "accepted") throw new Error("Missing camera publication.");
  assert.ok(response.result.data.recordingCheckpoint);
  return response.result.data.recordingCheckpoint;
}

test("camera re-observation and estimation after every retirement equal an uninterrupted recording", async (t) => {
  const cold = laboratory(t, "camera-cold", createWorkerRetention(0));
  const warm = laboratory(t, "camera-warm", createWorkerRetention(1));
  const patches: readonly Partial<Bm08Parameters>[] = [
    {},
    { dt: 2 },
    { d: 1 },
    { M: 8 },
    { exposure: 1 },
    { sigma: 0.1e-6 },
    { noiseSeed: "18446744073709551615" },
    { clickSeed: "9007199254740999" },
    { stageDrift: 0.2e-6 },
    { clicks: 7 },
    { noiseMethod: "known" },
    { coverage: 0.8 },
    { coverageTrials: 2 },
  ];
  let input = parameters;
  let original: ReturnType<typeof checkpoint> | undefined;
  let runId: string | undefined;
  for (const patch of patches) {
    input = { ...input, ...patch };
    const [recovered, uninterrupted] = await Promise.all([
      applyAccepted(cold, input),
      applyAccepted(warm, input),
    ]);
    original ??= checkpoint(cold);
    runId ??= recovered.runId;
    assert.equal(
      recovered.runId,
      runId,
      "Observation and estimator changes stay on the original run.",
    );
    assert.deepEqual(checkpoint(cold), original, JSON.stringify(patch));
    assert.deepEqual(checkpoint(warm), original);
    assert.deepEqual(science(recovered), science(uninterrupted), JSON.stringify(patch));
    assert.equal(recovered.stepIndex, uninterrupted.stepIndex);
    assert.equal(recovered.simulationTime, uninterrupted.simulationTime);
    assert.equal(cold.workers.at(-1)?.disposed, true);
  }
  assert.equal(cold.workers.length, patches.length);
  assert.equal(warm.workers.length, 1);
});

test("camera LRU preserves saved receipts and a hidden pending observation with all three seeds", async (t) => {
  const pool = createWorkerRetention(1);
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, "camera-hidden", pool, admission);
  const peer = laboratory(t, "camera-peer", pool, admission);
  const accepted = await applyAccepted(first, parameters);
  const receipt = first.session.acceptedPublication();
  assert.ok(receipt);
  const original = checkpoint(first);
  const exported = cameraObservationCsv(accepted, example.sourceDigest);
  await applyAccepted(peer, parameters);
  assert.equal(first.workers[0]?.disposed, true);
  assert.deepEqual(first.session.acceptedPublication(), receipt);
  assert.equal(cameraObservationCsv(accepted, example.sourceDigest), exported);

  first.session.setSchedulingPaused(true);
  first.session.apply({ ...parameters, exposure: 1, noiseSeed: "18446744073709551615" });
  const requested = first.session.getSnapshot().requested;
  await applyAccepted(peer, { ...parameters, coverage: 0.9 });
  assert.equal(first.workers.length, 1);
  assert.equal(first.session.getSnapshot().accepted, accepted);
  assert.equal(first.session.getSnapshot().requested, requested);
  assert.equal(first.session.getSchedulingPaused(), true);
  first.session.setSchedulingPaused(false);
  await until(() => !first.session.getSnapshot().pending);
  const view = first.session.getSnapshot();
  assert.equal(view.status, "accepted");
  assert.equal(view.requested, requested);
  assert.equal(view.accepted?.runId, accepted.runId);
  assert.equal(view.accepted?.parameters.seed, parameters.seed);
  assert.equal(view.accepted?.parameters.noiseSeed, "18446744073709551615");
  assert.equal(view.accepted?.parameters.clickSeed, parameters.clickSeed);
  assert.deepEqual(checkpoint(first), original);
  assert.equal(first.workers.length, 2);
  assert.ok(
    first.session.acceptedPublication(),
    "The reconstructed result retains a savable receipt.",
  );
});

test("a camera checkpoint mismatch keeps accepted frames exportable until an explicit new physical run", async (t) => {
  const lab = laboratory(t, "camera-mismatch", createWorkerRetention(0));
  const accepted = await applyAccepted(lab, parameters);
  const exported = cameraObservationCsv(accepted, example.sourceDigest);
  lab.control.corrupt = true;
  lab.session.apply({ ...parameters, exposure: 1 });
  await until(() => !lab.session.getSnapshot().pending);
  const failure = lab.session.getSnapshot();
  assert.equal(failure.status, "unavailable");
  assert.equal(failure.outcome?.outcome, "invariant-violation");
  assert.match(String(failure.outcome?.details?.checkpointNotice), /Start a new independent trial/);
  assert.equal(failure.accepted, accepted);
  assert.equal(cameraObservationCsv(accepted, example.sourceDigest), exported);

  lab.control.corrupt = false;
  assert.equal(lab.session.startNewRun({ ...parameters, exposure: 1 }).kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "accepted");
  assert.notEqual(lab.session.getSnapshot().accepted?.runId, accepted.runId);
  assert.equal(lab.session.getSnapshot().accepted?.parameters.seed, parameters.seed);
});

test("a missing camera checkpoint cannot make an idle worker eligible for eviction", async (t) => {
  const lab = laboratory(t, "camera-without-proof", createWorkerRetention(0));
  lab.control.omit = true;
  const accepted = await applyAccepted(lab, parameters);
  assert.equal(lab.workers[0]?.disposed, false);
  const next = await applyAccepted(lab, { ...parameters, coverage: 0.9 });
  assert.equal(next.runId, accepted.runId);
  assert.equal(lab.workers.length, 1);
});
