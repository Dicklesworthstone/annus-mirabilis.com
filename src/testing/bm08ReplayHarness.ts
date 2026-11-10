/** Real camera owners; the harness changes only transport timing and explicit corruption. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluatorSources } from "../../scripts/generate-observation.mjs";
import { BM08_DEFAULTS, type Bm08Parameters } from "../experiments/bm08/definition.ts";
import type { PreparedBm08Example } from "../experiments/bm08/session.ts";
import { createBm08TapeBinding } from "../experiments/bm08/tape.ts";
import { bm08CheckpointDigest, bm08ScientificState } from "../experiments/bm08/tapeCheckpoint.ts";
import { parseU64 } from "../experiments/identity/u64.ts";
import type { TapeControlEvent, TapeV2 } from "../experiments/permalink/types.ts";
import { applyWorkerSettings } from "../experiments/permalink/workerSessionTape.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { CAMERA_GRID_DT, CAMERA_GRID_STEPS } from "../physics/reference/inference/camera.ts";
import { createBm08Host } from "../workers/host/bm08Host.ts";
import { createBm08Recording, measureBm08 } from "../workers/operations/bm08.ts";
import type { LabResponse } from "../workers/protocol/bm08.ts";
import type { WorkerChannel } from "../workers/scheduler/hostScheduler.ts";
import type { VerifiablePublication } from "../workers/scheduler/verifiedChannel.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function bm08ReplayFixture() {
  const hash = createHash("sha256");
  for (const [path, source] of await evaluatorSources())
    hash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const parameters = { ...BM08_DEFAULTS, M: 8, clicks: 6 };
  const recording = await createBm08Recording(parameters, { yieldControl: async () => {} });
  assert.ok(recording.kind === "accepted");
  const measured = await measureBm08(recording.data, parameters, false);
  assert.ok(measured.kind === "accepted");
  const example: PreparedBm08Example = {
    sourceDigest,
    parameters,
    results: measured.data.outputs.map(encodeResult),
    stepIndex: measured.data.stepIndex,
    simulationTime: measured.data.simulationTime,
  };
  return { example, sourceDigest };
}
export type Bm08ReplayFixture = Awaited<ReturnType<typeof bm08ReplayFixture>>;
type ChannelControl = {
  disposed: boolean;
  requests: number;
  results: LabResponse[];
  result: Promise<void>;
  release(): void;
};
let instance = 0;

export function bm08Laboratory(
  fixture: Bm08ReplayFixture,
  options: {
    hold?: (channel: number) => boolean;
    transform?: (message: LabResponse, channel: number) => LabResponse;
  } = {},
) {
  const channels: ChannelControl[] = [];
  const waiters = new Map<number, ReturnType<typeof deferred<ChannelControl>>>();
  const factory = (): WorkerChannel => {
    const index = channels.length;
    const firstResult = deferred<void>();
    let listener: ((message: unknown) => void) | null = null;
    let onError: (() => void) | null = null;
    let held = options.hold?.(index) ?? false;
    const deliveries: (() => void)[] = [];
    const control: ChannelControl = {
      disposed: false,
      requests: 0,
      results: [],
      result: firstResult.promise,
      release() {
        held = false;
        for (const deliver of deliveries.splice(0)) deliver();
      },
    };
    const host = createBm08Host((message) => {
      const subscriber = listener;
      if (message.messageKind !== "result") {
        subscriber?.(structuredClone(message));
        return;
      }
      control.results.push(structuredClone(message));
      const delivered = options.transform?.(structuredClone(message), index) ?? message;
      const deliver = () => subscriber?.(structuredClone(delivered));
      firstResult.resolve();
      if (held) deliveries.push(deliver);
      else deliver();
    }, fixture.sourceDigest);
    channels.push(control);
    waiters.get(index)?.resolve(control);
    return {
      send(message) {
        if (
          message &&
          typeof message === "object" &&
          "messageKind" in message &&
          message.messageKind === "request"
        )
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
  const binding = createBm08TapeBinding(fixture.example, factory);
  const session = binding.createSession(`bm08-replay-test-${++instance}`);
  return {
    binding,
    session,
    channels,
    channel(index: number): Promise<ChannelControl> {
      const existing = channels[index];
      if (existing) return Promise.resolve(existing);
      const pending = deferred<ChannelControl>();
      waiters.set(index, pending);
      return pending.promise;
    },
  };
}

/** Three measurements of one physical recording: ideal, exposed, then localized. */
export async function recordBm08Checkpoints(
  fixture: Bm08ReplayFixture,
  parameters: Bm08Parameters = fixture.example.parameters,
) {
  const lab = bm08Laboratory(fixture);
  const initialConditions = { ...parameters, exposure: 0, sigma: 0 };
  const changes: TapeControlEvent[] = [
    {
      actionIndex: 1,
      commandClass: "measurement-change",
      paramId: "exposure",
      value: 0.5,
      previousValue: 0,
    },
    {
      actionIndex: 2,
      commandClass: "measurement-change",
      paramId: "sigma",
      value: 0.2e-6,
      previousValue: 0,
    },
  ];
  const stops: { tape: TapeV2; publication: VerifiablePublication }[] = [];
  let settings = initialConditions;
  try {
    for (let actionIndex = 0; actionIndex <= changes.length; actionIndex++) {
      const event = changes[actionIndex - 1];
      if (event) settings = { ...settings, [event.paramId]: event.value };
      let publication: VerifiablePublication | undefined;
      let digest: string | undefined;
      const outcome = await applyWorkerSettings(lab.session, settings, {
        verifyPublication: async (accepted) => {
          const checked = await bm08CheckpointDigest(accepted, fixture.sourceDigest, actionIndex);
          if (checked.kind !== "digest") return checked.notice;
          publication = accepted;
          digest = checked.digest;
          return null;
        },
      });
      assert.ok(outcome.kind === "restored" && publication && digest, JSON.stringify(outcome));
      stops.push({
        publication,
        tape: {
          tapeVersion: 2,
          experimentId: "bm-08",
          mode: "bm-08:default",
          modelIdentity: {
            modelId: "inference-bm08-host",
            modelVersion: 1,
            artifactDigest: fixture.sourceDigest.replace(/^source:/, "host:"),
          },
          constantSetId: "modern-si-2019",
          seed: parseU64(settings.seed),
          streamVersion: 1,
          allocationId: "bm-08.latent.v1",
          replayGrid: { baseSpacing: CAMERA_GRID_DT, horizon: CAMERA_GRID_DT * CAMERA_GRID_STEPS },
          initialConditions,
          events: changes.slice(0, actionIndex),
          acceptedCheckpoint: {
            acceptedActionIndex: actionIndex,
            acceptedInputRevision: 0,
            digest,
            scientificState: bm08ScientificState(settings),
          },
        },
      });
    }
    return stops;
  } finally {
    lab.session.disconnect();
  }
}
