/** Production Brownian hosts; only message timing and deliberate corruption are controlled. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluatorSources } from "../../scripts/generate-lab.mjs";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import type { PreparedBm06Example } from "../experiments/bm06/session.ts";
import {
  type BrownianGroupInputs,
  createBrownianGroupBundle,
} from "../experiments/groups/brownianTape.ts";
import { loadBrownianRadiusGroup } from "../experiments/groups/loadBrownianRadius.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createBm06Host } from "../workers/host/bm06Host.ts";
import { evaluateBm06 } from "../workers/operations/bm06.ts";
import type { LabResponse } from "../workers/protocol/bm06.ts";
import { createWorkerAdmission } from "../workers/scheduler/admission.ts";
import type { WorkerChannel } from "../workers/scheduler/hostScheduler.ts";
import { bm01Laboratory, bm01ReplayFixture, deferred } from "./bm01ReplayHarness.ts";

export async function brownianReplayFixture() {
  const tracer = await bm01ReplayFixture();
  const hash = createHash("sha256");
  for (const [path, source] of await evaluatorSources())
    hash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const parameters = {
    ...BM06_DEFAULTS,
    T: tracer.example.parameters.T,
    eta: tracer.example.parameters.eta,
    t: tracer.example.parameters.interval,
  };
  const evaluated = await evaluateBm06(parameters, { yieldControl: async () => {} });
  assert(evaluated.kind === "accepted", "The real probability fixture must evaluate.");
  const density: PreparedBm06Example = {
    sourceDigest,
    snapshotFunctionName: "gaussianPropagator",
    snapshotFunctionHash: "test-fixture",
    parameters,
    results: evaluated.data.outputs.map(encodeResult),
    stepIndex: evaluated.data.stepIndex,
    simulationTime: evaluated.data.simulationTime,
  };
  return { tracer, density, definition: loadBrownianRadiusGroup() };
}

export type BrownianReplayFixture = Awaited<ReturnType<typeof brownianReplayFixture>>;
type DensityControl = {
  disposed: boolean;
  requests: number;
  results: LabResponse[];
  result: Promise<void>;
  release(): void;
};
let instances = 0;

export function brownianReplayLaboratory(
  fixture: BrownianReplayFixture,
  options: {
    tracer?: Parameters<typeof bm01Laboratory>[1];
    densityHold?: (channel: number) => boolean;
    densityTransform?: (message: LabResponse, channel: number) => LabResponse;
  } = {},
) {
  const tracer = bm01Laboratory(fixture.tracer, options.tracer);
  const density: DensityControl[] = [];
  const factory = (): WorkerChannel => {
    const index = density.length;
    const firstResult = deferred<void>();
    let listener: ((message: unknown) => void) | null = null;
    let onError: (() => void) | null = null;
    let held = options.densityHold?.(index) ?? false;
    const deliveries: (() => void)[] = [];
    const control: DensityControl = {
      disposed: false,
      requests: 0,
      results: [],
      result: firstResult.promise,
      release() {
        held = false;
        for (const deliver of deliveries.splice(0)) deliver();
      },
    };
    const host = createBm06Host((message) => {
      const subscriber = listener;
      if (message.messageKind === "result") {
        control.results.push(structuredClone(message));
        const delivered = options.densityTransform?.(structuredClone(message), index) ?? message;
        const deliver = () => subscriber?.(structuredClone(delivered));
        firstResult.resolve();
        if (held) {
          deliveries.push(deliver);
          return;
        }
        deliver();
      } else subscriber?.(structuredClone(message));
    }, fixture.density.sourceDigest);
    density.push(control);
    return {
      send(message) {
        if (message && typeof message === "object" &&
          "messageKind" in message && message.messageKind === "request")
          control.requests++;
        void host.receive(structuredClone(message)).catch(() => onError?.());
      },
      listen(onMessage, failed) {
        listener = onMessage;
        onError = failed;
        queueMicrotask(() => host.hello());
        return () => {
          listener = null;
          onError = null;
        };
      },
      dispose() {
        control.disposed = true;
        host.dispose();
      },
    };
  };
  const resources = { admission: createWorkerAdmission(2), retention: null };
  const inputs: BrownianGroupInputs = {
    definition: fixture.definition,
    tracerExample: fixture.tracer.example,
    densityExample: fixture.density,
    workerFactories: [tracer.factory, factory],
    resources,
  };
  const bundle = createBrownianGroupBundle(`brownian-recording-test-${++instances}`, inputs);
  bundle.group.connect();
  return {
    inputs,
    bundle,
    tracer,
    density,
    resources,
    requests: () => tracer.channels.reduce((sum, c) => sum + c.requests, 0) +
      density.reduce((sum, c) => sum + c.requests, 0),
    disconnect() {
      bundle.group.disconnect();
      tracer.session.disconnect();
    },
  };
}
