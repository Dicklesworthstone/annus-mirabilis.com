import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Bm07Parameters } from "../experiments/bm07/definition.ts";
import { inferenceObservationCsv } from "../experiments/bm07/export.ts";
import { createBm07Session, type PreparedBm07Example } from "../experiments/bm07/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import prepared from "../generated/bm07-example.json";
import { createBm07Host } from "../workers/host/bm07Host.ts";
import type { LabResponse } from "../workers/protocol/bm07.ts";
import { createWorkerAdmission, type WorkerAdmission } from "../workers/scheduler/admission.ts";
import { createWorkerRetention, type WorkerRetention } from "../workers/scheduler/retention.ts";
import type { WorkerChannel } from "../workers/scheduler/scheduler.ts";

const example = prepared as PreparedBm07Example;
const parameters: Bm07Parameters = {
  ...example.parameters,
  seed: "9007199254740993",
  M: 8,
  coverageTrials: 0,
};
const executionCounters = new Set(["requestDraws", "reusedRecording", "retainedBytes"]);

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(condition(), "The inference owner did not reach the expected state.");
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
    const host = createBm07Host((message) => {
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
  const session = createBm07Session(id, example, factory, { admission, retention });
  t.after(() => session.disconnect());
  return { session, workers, responses, control };
}
type Laboratory = ReturnType<typeof laboratory>;

async function applyAccepted(lab: Laboratory, input: Bm07Parameters) {
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
  if (response?.result.kind !== "accepted") throw new Error("Missing inference publication.");
  assert.ok(response.result.data.recordingCheckpoint);
  return response.result.data.recordingCheckpoint;
}

test("synthetic inference re-observation after every retirement matches an uninterrupted owner", async (t) => {
  const cold = laboratory(t, "inference-cold", createWorkerRetention(0));
  const warm = laboratory(t, "inference-warm", createWorkerRetention(1));
  const patches: readonly Partial<Bm07Parameters>[] = [
    {},
    { M: 12 },
    { d: 1 },
    { dt: 2 },
    { calibrationScale: 1.2 },
    { T: 300 },
    { eta: 0.0012 },
    { a: 0.7e-6 },
    { radiusKnown: true },
    { estimator: "drift-centered" },
    { coverage: 0.8 },
    { temperatureError: 0.01, viscosityError: 0.03, radiusError: 0.05, inputCoverage: 0.99 },
    { intervalKind: "combined" },
    { intervalKind: "conditional", coverageTrials: 2 },
    { constantSetId: "modern-si-2019" },
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
    assert.equal(recovered.runId, runId, "Measurement and inference assumptions do not start a new world.");
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

test("a hidden inference measurement survives LRU retirement without replacing its token or physical trial", async (t) => {
  const pool = createWorkerRetention(1);
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, "inference-hidden", pool, admission);
  const peer = laboratory(t, "inference-peer", pool, admission);
  const accepted = await applyAccepted(first, parameters);
  const original = checkpoint(first);
  const exported = inferenceObservationCsv(accepted, example.sourceDigest);
  first.session.setSchedulingPaused(true);
  first.session.apply({ ...parameters, M: 12, dt: 2, estimator: "drift-centered" });
  const requested = first.session.getSnapshot().requested;
  await applyAccepted(peer, parameters);
  assert.equal(first.workers[0]?.disposed, true);
  assert.equal(first.workers.length, 1);
  assert.equal(first.session.getSnapshot().accepted, accepted);
  assert.equal(first.session.getSnapshot().requested, requested);
  assert.equal(first.session.getSchedulingPaused(), true);
  assert.equal(inferenceObservationCsv(accepted, example.sourceDigest), exported);
  first.session.setSchedulingPaused(false);
  await until(() => !first.session.getSnapshot().pending);
  const view = first.session.getSnapshot();
  assert.equal(view.status, "accepted");
  assert.equal(view.requested, requested);
  assert.equal(view.accepted?.runId, accepted.runId);
  assert.equal(view.accepted?.parameters.seed, parameters.seed);
  assert.deepEqual(checkpoint(first), original);
  assert.equal(first.workers.length, 2);
});

test("a changed complete inference path is refused while previous observations remain exportable", async (t) => {
  const lab = laboratory(t, "inference-mismatch", createWorkerRetention(0));
  const accepted = await applyAccepted(lab, parameters);
  const exported = inferenceObservationCsv(accepted, example.sourceDigest);
  lab.control.corrupt = true;
  lab.session.apply({ ...parameters, M: 12 });
  await until(() => !lab.session.getSnapshot().pending);
  const failure = lab.session.getSnapshot();
  assert.equal(failure.status, "unavailable");
  assert.equal(failure.outcome?.outcome, "invariant-violation");
  assert.match(String(failure.outcome?.details?.checkpointNotice), /Start a new independent trial/);
  assert.equal(failure.accepted, accepted);
  assert.equal(inferenceObservationCsv(accepted, example.sourceDigest), exported);
  lab.control.corrupt = false;
  assert.equal(lab.session.startNewRun({ ...parameters, M: 12 }).kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().status, "accepted");
  assert.notEqual(lab.session.getSnapshot().accepted?.runId, accepted.runId);
  assert.equal(lab.session.getSnapshot().accepted?.parameters.seed, parameters.seed);
});

test("inference workers without a complete recording witness remain pinned", async (t) => {
  const lab = laboratory(t, "inference-without-proof", createWorkerRetention(0));
  lab.control.omit = true;
  const accepted = await applyAccepted(lab, parameters);
  assert.equal(lab.workers[0]?.disposed, false);
  const next = await applyAccepted(lab, { ...parameters, coverage: 0.9 });
  assert.equal(next.runId, accepted.runId);
  assert.equal(lab.workers.length, 1);
});

test("historical and uploaded observations remain outside the synthetic recording owner", async (t) => {
  const lab = laboratory(t, "inference-owner-boundary", createWorkerRetention(0));
  const accepted = await applyAccepted(lab, parameters);
  for (const observationSet of ["perrin-1909", "kitchen"] as const) {
    assert.equal(lab.session.apply({ ...parameters, observationSet }).kind, "accepted");
    await until(() => !lab.session.getSnapshot().pending);
    assert.equal(lab.session.getSnapshot().status, "refused");
    assert.equal(lab.session.getSnapshot().refusal?.code, "invalid-parameter");
    assert.equal(lab.session.getSnapshot().accepted, accepted);
  }
});
