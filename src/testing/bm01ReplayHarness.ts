/** Real BM01 worker hosts; only transport timing and deliberate corruption are test controls. */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluatorSources } from "../../scripts/generate-tracers.mjs";
import { BM01_DEFAULTS, type Bm01Parameters } from "../experiments/bm01/definition.ts";
import type { PreparedBm01Example } from "../experiments/bm01/session.ts";
import { createBm01TapeBinding } from "../experiments/bm01/tape.ts";
import { bm01CheckpointDigest, bm01ScientificState } from "../experiments/bm01/tapeCheckpoint.ts";
import { parseU64 } from "../experiments/identity/u64.ts";
import type { TapeControlEvent, TapeV2 } from "../experiments/permalink/types.ts";
import { applyWorkerSettings } from "../experiments/permalink/workerSessionTape.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createBm01Host } from "../workers/host/bm01Host.ts";
import { type Bm01Recorder, createBm01Recording, measureBm01 } from "../workers/operations/bm01.ts";
import type { LabResponse } from "../workers/protocol/bm01.ts";
import type { WorkerChannel } from "../workers/scheduler/hostScheduler.ts";
import type { VerifiablePublication } from "../workers/scheduler/verifiedChannel.ts";
import { loadPinnedFrankenSimRecorder } from "./bm01FrankenSimRecorder.ts";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function bm01ReplayFixture() {
  const hash = createHash("sha256");
  for (const [path, source] of await evaluatorSources())
    hash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const recorder = await loadPinnedFrankenSimRecorder();
  if (typeof recorder === "string") assert.fail(recorder);
  const parameters = { ...BM01_DEFAULTS, M: 4, H: 1 };
  const recording = await createBm01Recording(parameters, { yieldControl: async () => {} });
  assert.ok(recording.kind === "accepted", "The real static fixture must record.");
  const result = measureBm01(recording.data, parameters, false);
  assert.ok(result.kind === "accepted", "The real static fixture must measure.");
  const example: PreparedBm01Example = {
    sourceDigest,
    snapshotFunctionName: "stokesEinsteinD",
    snapshotFunctionHash: "test-fixture",
    parameters,
    results: result.data.outputs.map(encodeResult),
    stepIndex: result.data.stepIndex,
    simulationTime: result.data.simulationTime,
  };
  return { example, recorder, sourceDigest };
}

export type Bm01ReplayFixture = Awaited<ReturnType<typeof bm01ReplayFixture>>;
export type ChannelControl = {
  disposed: boolean;
  recordings: number;
  requests: number;
  results: LabResponse[];
  result: Promise<void>;
  release(): void;
};
let instances = 0;

export function bm01Laboratory(
  fixture: Bm01ReplayFixture,
  options: {
    hold?: (channel: number) => boolean;
    recorder?: (channel: number) => Bm01Recorder;
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
      recordings: 0,
      requests: 0,
      results: [],
      result: firstResult.promise,
      release() {
        held = false;
        for (const deliver of deliveries.splice(0)) deliver();
      },
    };
    const recorder = options.recorder?.(index) ?? fixture.recorder;
    const host = createBm01Host(
      (message) => {
        const subscriber = listener;
        if (message.messageKind === "result") {
          control.results.push(structuredClone(message));
          const delivered = options.transform?.(structuredClone(message), index) ?? message;
          const deliver = () => subscriber?.(structuredClone(delivered));
          firstResult.resolve();
          if (held) {
            deliveries.push(deliver);
            return;
          }
          deliver();
        } else subscriber?.(structuredClone(message));
      },
      fixture.sourceDigest,
      {
        ownerId: recorder.ownerId,
        record(setup, settings) {
          control.recordings++;
          return recorder.record(setup, settings);
        },
      },
    );
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
  const binding = createBm01TapeBinding(fixture.example, factory);
  const session = binding.createSession(`bm01-replay-test-${++instances}`);
  return {
    binding,
    session,
    factory,
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

/** Record fixture checkpoints from the real worker; never substitute a settings checksum. */
export async function recordBm01Checkpoints(
  fixture: Bm01ReplayFixture,
  parameters: Bm01Parameters,
  intervals: readonly number[],
) {
  const lab = bm01Laboratory(fixture);
  const stops: { tape: TapeV2; publication: VerifiablePublication }[] = [];
  const initialConditions = { ...parameters, interval: 0 };
  const events: TapeControlEvent[] = [];
  let previousValue = 0;
  try {
    for (const [index, interval] of intervals.entries()) {
      const actionIndex = index + 1;
      const settings = { ...parameters, interval };
      let publication: VerifiablePublication | undefined;
      let digest: string | undefined;
      const outcome = await applyWorkerSettings(lab.session, settings, {
        verifyPublication: async (accepted) => {
          const checkpoint = await bm01CheckpointDigest(
            accepted,
            fixture.sourceDigest,
            actionIndex,
          );
          if (checkpoint.kind !== "digest") return checkpoint.notice;
          publication = accepted;
          digest = checkpoint.digest;
          return null;
        },
      });
      assert.ok(
        outcome.kind === "restored" && publication && digest,
        `The actual Brownian owner could not record this fixture: ${JSON.stringify(outcome)}`,
      );
      events.push({
        actionIndex,
        commandClass: "measurement-change",
        paramId: "interval",
        value: interval,
        previousValue,
      });
      stops.push({
        publication,
        tape: {
          tapeVersion: 2,
          experimentId: "bm-01",
          mode: "bm-01:default",
          modelIdentity: {
            modelId: "brownian-motion-reference",
            modelVersion: 1,
            artifactDigest: fixture.sourceDigest.replace(/^source:/, "host:"),
          },
          constantSetId: settings.constantSetId,
          seed: parseU64(settings.seed),
          streamVersion: 1,
          allocationId: "bm-01.latent.v1",
          replayGrid: { baseSpacing: settings.h, horizon: settings.H },
          initialConditions,
          events: [...events],
          acceptedCheckpoint: {
            acceptedActionIndex: actionIndex,
            acceptedInputRevision: 0,
            digest,
            scientificState: bm01ScientificState(settings),
          },
        },
      });
      previousValue = interval;
    }
    return stops;
  } finally {
    lab.session.disconnect();
  }
}
