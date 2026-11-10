/** Real walk-worker hosts; tests control only transport timing and deliberate corruption. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluatorSources } from "../../scripts/generate-walks.mjs";
import { BM05_DEFAULTS, type Bm05Parameters } from "../experiments/bm05/definition.ts";
import type { PreparedBm05Example } from "../experiments/bm05/session.ts";
import { createBm05TapeBinding } from "../experiments/bm05/tape.ts";
import { bm05CheckpointDigest, bm05ScientificState } from "../experiments/bm05/tapeCheckpoint.ts";
import { parseU64 } from "../experiments/identity/u64.ts";
import type { TapeControlEvent, TapeV2 } from "../experiments/permalink/types.ts";
import { applyWorkerSettings } from "../experiments/permalink/workerSessionTape.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { WalkNormalSource } from "../physics/reference/diffusion/walks.ts";
import { createBm05Host } from "../workers/host/bm05Host.ts";
import { createBm05Recording, measureBm05 } from "../workers/operations/bm05.ts";
import type { LabResponse } from "../workers/protocol/bm05.ts";
import type { WorkerChannel } from "../workers/scheduler/hostScheduler.ts";
import type { VerifiablePublication } from "../workers/scheduler/verifiedChannel.ts";
import { frankensimWalkNormals } from "../workers/wasm/frankensimWalkNormals.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";
import { loadPinnedBundle } from "../workers/wasm/pinnedBundle.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function bm05ReplayFixture() {
  const hash = createHash("sha256");
  for (const [path, source] of await evaluatorSources())
    hash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const loaded = await loadPinnedBundle({
    wasmUrl: resolve(
      "public/wasm",
      PINNED_ARTIFACT.bundleId,
      PINNED_ARTIFACT.hashPrefix,
      PINNED_ARTIFACT.wasmFile,
    ),
    readBytes: (path) => readFile(path),
  });
  assert.ok(loaded.kind === "loaded", "The real pinned normal engine must load.");
  const normals = frankensimWalkNormals(loaded.exports);
  const parameters = { ...BM05_DEFAULTS, walkers: 4, runSteps: 4 };
  const recording = await createBm05Recording(parameters, { yieldControl: async () => {} });
  assert.ok(recording.kind === "accepted", "The real static fixture must record.");
  const result = await measureBm05(recording.data, parameters, false);
  assert.ok(result.kind === "accepted", "The real static fixture must measure.");
  const example: PreparedBm05Example = {
    sourceDigest,
    snapshotFunctionName: "kernelDiffusivity",
    snapshotFunctionHash: "test-fixture",
    parameters,
    results: result.data.outputs.map(encodeResult),
    stepIndex: result.data.stepIndex,
    simulationTime: result.data.simulationTime,
  };
  return { example, normals, sourceDigest };
}

export type Bm05ReplayFixture = Awaited<ReturnType<typeof bm05ReplayFixture>>;
export type Bm05ChannelControl = {
  disposed: boolean;
  requests: number;
  results: LabResponse[];
  result: Promise<void>;
  release(): void;
};
let instances = 0;

export function bm05Laboratory(
  fixture: Bm05ReplayFixture,
  options: {
    hold?: (channel: number) => boolean;
    normals?: (channel: number) => WalkNormalSource;
    transform?: (message: LabResponse, channel: number) => LabResponse;
  } = {},
) {
  const channels: Bm05ChannelControl[] = [];
  const waiters = new Map<number, ReturnType<typeof deferred<Bm05ChannelControl>>>();
  const factory = (): WorkerChannel => {
    const index = channels.length;
    const firstResult = deferred<void>();
    let listener: ((message: unknown) => void) | null = null;
    let onError: (() => void) | null = null;
    let held = options.hold?.(index) ?? false;
    const deliveries: (() => void)[] = [];
    const control: Bm05ChannelControl = {
      disposed: false,
      requests: 0,
      results: [],
      result: firstResult.promise,
      release() {
        held = false;
        for (const deliver of deliveries.splice(0)) deliver();
      },
    };
    const host = createBm05Host(
      (message) => {
        const subscriber = listener;
        if (message.messageKind === "result") {
          control.results.push(structuredClone(message));
          const delivered = options.transform?.(structuredClone(message), index) ?? message;
          const deliver = () => subscriber?.(structuredClone(delivered));
          firstResult.resolve();
          if (held) deliveries.push(deliver);
          else deliver();
        } else subscriber?.(structuredClone(message));
      },
      fixture.sourceDigest,
      options.normals?.(index) ?? fixture.normals,
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
  const binding = createBm05TapeBinding(fixture.example, factory);
  const session = binding.createSession(`bm05-replay-test-${++instances}`);
  return {
    binding,
    session,
    factory,
    channels,
    channel(index: number): Promise<Bm05ChannelControl> {
      const existing = channels[index];
      if (existing) return Promise.resolve(existing);
      const pending = deferred<Bm05ChannelControl>();
      waiters.set(index, pending);
      return pending.promise;
    },
  };
}

/** Record actual worker publications, including all walker coordinates and stream positions. */
export async function recordBm05Checkpoints(
  fixture: Bm05ReplayFixture,
  initial: Bm05Parameters,
  events: readonly TapeControlEvent[],
) {
  const lab = bm05Laboratory(fixture);
  const stops: { tape: TapeV2; publication: VerifiablePublication }[] = [];
  let settings = initial;
  try {
    for (const [index, event] of events.entries()) {
      settings = { ...settings, [event.paramId]: event.value };
      let publication: VerifiablePublication | undefined;
      let digest: string | undefined;
      const outcome = await applyWorkerSettings(lab.session, settings, {
        verifyPublication: async (accepted) => {
          const checkpoint = await bm05CheckpointDigest(
            accepted,
            fixture.sourceDigest,
            event.actionIndex,
          );
          if (checkpoint.kind !== "digest") return checkpoint.notice;
          publication = accepted;
          digest = checkpoint.digest;
          return null;
        },
      });
      assert.ok(
        outcome.kind === "restored" && publication && digest,
        `The real walk owner could not record this fixture: ${JSON.stringify(outcome)}`,
      );
      stops.push({
        publication,
        tape: {
          tapeVersion: 2,
          experimentId: "bm-05",
          mode: "bm-05:default",
          modelIdentity: {
            modelId: "bm05-host-preview-v1",
            modelVersion: 1,
            artifactDigest: fixture.sourceDigest.replace(/^source:/, "host:"),
          },
          constantSetId: "not-applicable",
          seed: parseU64(settings.seed),
          streamVersion: 1,
          allocationId: "bm-05.walk.v1",
          replayGrid: { baseSpacing: settings.tau, horizon: settings.runSteps * settings.tau },
          initialConditions: initial,
          events: events.slice(0, index + 1),
          acceptedCheckpoint: {
            acceptedActionIndex: event.actionIndex,
            acceptedInputRevision: 0,
            digest,
            scientificState: bm05ScientificState(settings),
          },
        },
      });
    }
    return stops;
  } finally {
    lab.session.disconnect();
  }
}
