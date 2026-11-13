import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test, { type TestContext } from "node:test";
import {
  BM06_DEFAULTS,
  BM06_FRANKENSIM_GRID_OWNER,
  BM06_HOST_GRID_OWNER,
  BM06_OUTPUTS,
  type Bm06Parameters,
} from "../experiments/bm06/definition.ts";
import { createBm06Session, type PreparedBm06Example } from "../experiments/bm06/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import prepared from "../generated/bm06-example.json";
import { createBm06Host } from "../workers/host/bm06Host.ts";
import { type Bm06GridStepper, HOST_GRID_STEPPER } from "../workers/operations/bm06.ts";
import type { LabResponse } from "../workers/protocol/bm06.ts";
import { createWorkerAdmission, type WorkerAdmission } from "../workers/scheduler/admission.ts";
import { createWorkerRetention, type WorkerRetention } from "../workers/scheduler/retention.ts";
import type { WorkerChannel } from "../workers/scheduler/scheduler.ts";
import { frankensimGridStepper } from "../workers/wasm/frankensimFtcsGrid.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";
import { loadPinnedBundle } from "../workers/wasm/pinnedBundle.ts";

const example = prepared as PreparedBm06Example;
const parameters: Bm06Parameters = { ...BM06_DEFAULTS, gridEnabled: true };

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(condition(), "The spreading calculation did not reach the expected state.");
}

function science(snapshot: AcceptedSnapshot): readonly ScientificResult[] {
  return snapshot.outputs.map((output) =>
    output.status === "value"
      ? {
          ...output,
          value: typeof output.value === "number" ? output.value : output.value.copy(),
        }
      : output,
  );
}

function changeOutput(output: ScientificResult): ScientificResult {
  if (output.status === "value") {
    const change = (value: number) => value + Math.max(Math.abs(value) * 0.01, 1e-300);
    if (typeof output.value === "number") return { ...output, value: change(output.value) };
    const value = output.value.slice();
    const index = value.length - 1;
    value[index] = change(value[index] as number);
    return { ...output, value };
  }
  if (output.status === "not-applicable") return { ...output, reason: output.reason + " changed" };
  if (output.status === "analytic-limit")
    return {
      ...output,
      representation:
        output.representation.kind === "point-mass"
          ? { ...output.representation, location: output.representation.location + 1 }
          : { ...output.representation, value: output.representation.value + 1 },
    };
  throw new Error("The BM06 plant needs an admitted output status.");
}

function laboratory(
  t: TestContext,
  id: string,
  retention: WorkerRetention | null,
  admission: WorkerAdmission = createWorkerAdmission(1),
) {
  const control: {
    corruptQuantity: string | null;
    stepper: Bm06GridStepper;
    hold: Promise<void> | null;
  } = { corruptQuantity: null, stepper: HOST_GRID_STEPPER, hold: null };
  const workers: { disposed: boolean; stepCalls: number }[] = [];
  const responses: LabResponse[] = [];
  const factory = (): WorkerChannel => {
    let receive: ((message: unknown) => void) | undefined;
    let failed: (() => void) | undefined;
    const worker = { disposed: false, stepCalls: 0 };
    // Like the actual browser owner, one connection chooses one engine for its lifetime.
    const chosen = control.stepper;
    const counted: Bm06GridStepper = {
      async step(run, options) {
        worker.stepCalls++;
        if (control.hold) await control.hold;
        return chosen.step(run, { ...options, yieldControl: async () => {} });
      },
    };
    const host = createBm06Host(
      (message) => {
        if (worker.disposed) return;
        let packet = structuredClone(message);
        if (packet.messageKind === "result") {
          if (packet.result.kind === "accepted" && control.corruptQuantity)
            packet = {
              ...packet,
              result: {
                kind: "accepted",
                data: {
                  ...packet.result.data,
                  outputs: packet.result.data.outputs.map((output) =>
                    output.quantityId === control.corruptQuantity ? changeOutput(output) : output,
                  ),
                },
              },
            };
          responses.push(packet);
        }
        receive?.(packet);
      },
      example.sourceDigest,
      counted,
    );
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
  const session = createBm06Session(id, example, factory, { admission, retention });
  t.after(() => session.disconnect());
  return {
    session,
    workers,
    responses,
    control,
    stepCalls: () => workers.reduce((count, worker) => count + worker.stepCalls, 0),
  };
}
type Laboratory = ReturnType<typeof laboratory>;

async function applyAccepted(lab: Laboratory, input: Bm06Parameters) {
  assert.equal(lab.session.apply(input).kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  const view = lab.session.getSnapshot();
  assert.equal(view.status, "accepted", JSON.stringify(view.outcome ?? view.refusal));
  assert.ok(view.accepted);
  return view.accepted;
}

test("the complete spreading field reconstructs exactly across interval changes, profiles, limits and copied diffusivity", async (t) => {
  const setups: readonly Bm06Parameters[] = [
    parameters,
    { ...parameters, gridProfile: "step" },
    { ...parameters, gridProfile: "two-spikes" },
    { ...parameters, t: 0 },
    { ...parameters, gridEnabled: false },
    { ...parameters, gridEnabled: false, t: 0 },
    {
      ...parameters,
      copiedDiffusivityInstanceId: "source-tracer",
      copiedDiffusivityRunId: "recorded-run",
      copiedDiffusivitySnapshotVersion: 7,
      copiedDiffusivityValue: 2e-13,
    },
  ];
  const intervals = [
    { lower: -1e-6, upper: 1e-6 },
    { lower: 0, upper: 1e-6 },
    { lower: -0.5e-6, upper: 0.5e-6 },
    { lower: 0, upper: 0 },
  ];
  for (const [index, setup] of setups.entries()) {
    const cold = laboratory(t, `spreading-cold-${index}`, createWorkerRetention(0));
    const warm = laboratory(t, `spreading-warm-${index}`, createWorkerRetention(1));
    assert.equal(cold.workers.length, 0, "The static example does not start or attest a worker.");
    let original: AcceptedSnapshot | undefined;
    for (const interval of intervals) {
      const [recovered, uninterrupted] = await Promise.all([
        applyAccepted(cold, { ...setup, ...interval }),
        applyAccepted(warm, { ...setup, ...interval }),
      ]);
      original ??= recovered;
      assert.equal(recovered.runId, original.runId);
      assert.equal(recovered.revisions.input, original.revisions.input);
      assert.equal(recovered.stepIndex, original.stepIndex);
      assert.equal(recovered.simulationTime, original.simulationTime);
      assert.deepEqual(
        science(recovered),
        science(uninterrupted),
        JSON.stringify({ setup, interval }),
      );
      assert.deepEqual(
        science(recovered).filter((output) => output.quantityId !== "intervalProbability"),
        science(original).filter((output) => output.quantityId !== "intervalProbability"),
        "Only the selected interval's probability may change on this run.",
      );
      assert.equal(cold.workers.at(-1)?.disposed, true);
    }
    assert.equal(cold.workers.length, intervals.length);
    assert.equal(warm.workers.length, 1);
    assert.equal(cold.stepCalls(), setup.gridEnabled ? intervals.length : 0);
    assert.equal(
      warm.stepCalls(),
      setup.gridEnabled ? 1 : 0,
      "Warm remeasurement never steps again.",
    );
  }
});

test("a hidden pending interval survives peer LRU pressure with the same request and accepted calculation", async (t) => {
  const pool = createWorkerRetention(1);
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, "spreading-hidden", pool, admission);
  const peer = laboratory(t, "spreading-peer", pool, admission);
  const accepted = await applyAccepted(first, parameters);
  const exported = science(accepted).map(encodeResult);
  assert.equal(first.stepCalls(), 1, "Visible positive control must perform actual grid work.");
  first.session.setSchedulingPaused(true);
  first.session.apply({ ...parameters, lower: 0 });
  const requested = first.session.getSnapshot().requested;
  await applyAccepted(peer, parameters);
  assert.equal(first.workers[0]?.disposed, true);
  assert.equal(first.workers.length, 1);
  assert.equal(first.stepCalls(), 1, "Hidden measurement starts no replacement work.");
  assert.equal(first.session.getSnapshot().requested, requested);
  assert.equal(first.session.getSnapshot().accepted, accepted);
  assert.equal(first.session.getSchedulingPaused(), true);
  assert.deepEqual(science(accepted).map(encodeResult), exported);
  first.session.setSchedulingPaused(false);
  await until(() => !first.session.getSnapshot().pending);
  const recovered = first.session.getSnapshot();
  assert.equal(recovered.status, "accepted");
  assert.equal(recovered.requested, requested);
  assert.equal(recovered.accepted?.runId, accepted.runId);
  assert.equal(recovered.accepted?.stepIndex, accepted.stepIndex);
  assert.equal(recovered.accepted?.simulationTime, accepted.simulationTime);
  assert.equal(recovered.accepted?.parameters.lower, 0);
  assert.equal(first.workers.length, 2);
  assert.equal(
    first.stepCalls(),
    2,
    "Cold recovery performs an explicitly verified reconstruction.",
  );
});

test("every immutable scientific output is covered, and a mismatch preserves accepted export data", async (t) => {
  for (const quantity of Object.keys(BM06_OUTPUTS).filter((id) => id !== "intervalProbability")) {
    const lab = laboratory(t, `spreading-mismatch-${quantity}`, createWorkerRetention(0));
    const accepted = await applyAccepted(lab, parameters);
    const exported = science(accepted).map(encodeResult);
    lab.control.corruptQuantity = quantity;
    lab.session.apply({ ...parameters, lower: 0 });
    await until(() => !lab.session.getSnapshot().pending);
    const failure = lab.session.getSnapshot();
    assert.equal(failure.status, "unavailable", quantity);
    assert.equal(failure.outcome?.outcome, "invariant-violation", quantity);
    assert.match(String(failure.outcome?.details?.checkpointNotice), /Start a new calculation/);
    assert.equal(failure.accepted, accepted, quantity);
    assert.deepEqual(science(accepted).map(encodeResult), exported, quantity);
  }
});

test("analytic-limit metadata is part of the complete state and explicit new calculation can recover", async (t) => {
  const lab = laboratory(t, "spreading-point-mass", createWorkerRetention(0));
  const input = { ...parameters, gridEnabled: false, t: 0 };
  const accepted = await applyAccepted(lab, input);
  lab.control.corruptQuantity = "probabilityDensity";
  lab.session.apply({ ...input, lower: 0 });
  await until(() => !lab.session.getSnapshot().pending);
  assert.equal(lab.session.getSnapshot().outcome?.outcome, "invariant-violation");
  assert.equal(lab.session.getSnapshot().accepted, accepted);
  lab.control.corruptQuantity = null;
  assert.equal(lab.session.startNewRun({ ...input, lower: 0 }).kind, "accepted");
  await until(() => !lab.session.getSnapshot().pending);
  const recovered = lab.session.getSnapshot();
  assert.equal(recovered.status, "accepted");
  assert.notEqual(recovered.accepted?.runId, accepted.runId);
  assert.equal(recovered.accepted?.parameters.lower, 0);
  assert.equal(recovered.accepted?.simulationTime, 0);
});

test("a real pinned grid reconstructs identically but may not silently switch to the host engine", async (t) => {
  const wasmPath = resolve(
    "public/wasm",
    PINNED_ARTIFACT.bundleId,
    PINNED_ARTIFACT.hashPrefix,
    PINNED_ARTIFACT.wasmFile,
  );
  const loaded = await loadPinnedBundle({ wasmUrl: wasmPath, readBytes: (path) => readFile(path) });
  assert.equal(loaded.kind, "loaded", loaded.kind === "refused" ? loaded.message : undefined);
  let moduleCalls = 0;
  const real = loaded.exports;
  const stepper = frankensimGridStepper({
    ...real,
    diffusion1d_frames(...args) {
      moduleCalls++;
      return real.diffusion1d_frames(...args);
    },
  });
  const cold = laboratory(t, "spreading-real-wasm-cold", createWorkerRetention(0));
  const warm = laboratory(t, "spreading-real-wasm-warm", createWorkerRetention(1));
  cold.control.stepper = stepper;
  warm.control.stepper = stepper;
  for (const lower of [-1e-6, 0]) {
    const [a, b] = await Promise.all([
      applyAccepted(cold, { ...parameters, lower }),
      applyAccepted(warm, { ...parameters, lower }),
    ]);
    assert.deepEqual(science(a), science(b));
    assert.equal(
      a.outputs.find((output) => output.quantityId === "gridDensity")?.ownerId,
      BM06_FRANKENSIM_GRID_OWNER,
    );
  }
  assert.equal(moduleCalls, 3, "Two cold runs and one warm run execute the real module.");
  const accepted = cold.session.getSnapshot().accepted;
  assert.ok(accepted);
  const exported = science(accepted).map(encodeResult);
  cold.control.stepper = HOST_GRID_STEPPER;
  const requested = { ...parameters, lower: -0.5e-6, upper: 0.5e-6 };
  cold.session.apply(requested);
  await until(() => !cold.session.getSnapshot().pending);
  const failure = cold.session.getSnapshot();
  assert.equal(failure.status, "unavailable");
  assert.equal(failure.outcome?.outcome, "invariant-violation");
  assert.equal(failure.accepted, accepted);
  assert.deepEqual(science(accepted).map(encodeResult), exported);
  assert.equal(moduleCalls, 3);
  const response = cold.responses.at(-1);
  assert.equal(
    response?.result.kind,
    "accepted",
    "The host candidate passed the ordinary protocol.",
  );
  if (response?.result.kind !== "accepted") throw new Error("Missing host candidate.");
  const field = response.result.data.outputs.find((output) => output.quantityId === "gridDensity");
  const previousField = science(accepted).find((output) => output.quantityId === "gridDensity");
  assert.equal(field?.ownerId, BM06_HOST_GRID_OWNER);
  assert.equal(field?.status, "value");
  assert.equal(previousField?.status, "value");
  if (field?.status === "value" && previousField?.status === "value")
    assert.deepEqual(
      field.value,
      previousField.value,
      "Even bitwise-equal fields keep their actual engine identity.",
    );
  assert.equal(cold.session.startNewRun(requested).kind, "accepted");
  await until(() => !cold.session.getSnapshot().pending);
  const recovered = cold.session.getSnapshot();
  assert.equal(recovered.status, "accepted");
  assert.notEqual(recovered.accepted?.runId, accepted.runId);
  assert.equal(
    recovered.accepted?.outputs.find((output) => output.quantityId === "gridDensity")?.ownerId,
    BM06_HOST_GRID_OWNER,
  );
});

test("an executing grid is never retired under peer pressure", async (t) => {
  const pool = createWorkerRetention(0);
  const admission = createWorkerAdmission(2);
  const first = laboratory(t, "spreading-active", pool, admission);
  const peer = laboratory(t, "spreading-active-peer", pool, admission);
  let release!: () => void;
  first.control.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  first.session.apply(parameters);
  await until(() => first.stepCalls() === 1);
  await applyAccepted(peer, parameters);
  assert.equal(peer.workers[0]?.disposed, true);
  assert.equal(first.workers[0]?.disposed, false);
  assert.equal(first.session.getSnapshot().pending, true);
  release();
  await until(() => !first.session.getSnapshot().pending);
  assert.equal(first.session.getSnapshot().status, "accepted");
  assert.equal(first.workers[0]?.disposed, true);
});

test("an explicit warm owner remains pinned while independent peers are reclaimed", async (t) => {
  const pinned = laboratory(t, "spreading-pinned", null);
  const peer = laboratory(t, "spreading-unpinned", createWorkerRetention(0));
  const first = await applyAccepted(pinned, parameters);
  await applyAccepted(peer, parameters);
  const second = await applyAccepted(pinned, { ...parameters, lower: 0 });
  assert.equal(second.runId, first.runId);
  assert.equal(pinned.workers.length, 1);
  assert.equal(pinned.stepCalls(), 1);
  assert.equal(pinned.workers[0]?.disposed, false);
  assert.equal(peer.workers[0]?.disposed, true);
});

test("a reentrant new request cannot inherit a superseded outer interval change", async (t) => {
  const lab = laboratory(t, "spreading-reentrant", createWorkerRetention(0));
  let replaced = false;
  const release = lab.session.subscribe(() => {
    if (!replaced && lab.session.getSnapshot().pending) {
      replaced = true;
      lab.session.apply({ ...parameters, eta: 0.002 });
    }
  });
  t.after(release);
  const outcome = lab.session.apply({ ...parameters, T: 300, lower: 0 });
  assert.equal(outcome.kind, "outcome");
  if (outcome.kind === "outcome") assert.equal(outcome.outcome.outcome, "superseded");
  await until(() => !lab.session.getSnapshot().pending);
  const accepted = lab.session.getSnapshot().accepted;
  assert.equal(lab.session.getSnapshot().status, "accepted");
  assert.equal(accepted?.parameters.eta, 0.002);
  assert.equal(accepted?.parameters.T, parameters.T);
  assert.equal(accepted?.parameters.lower, parameters.lower);
});
