/** Real inference owners; the harness changes only transport timing and explicit corruption. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluatorSources } from "../../scripts/generate-inference.mjs";
import { BM07_DEFAULTS } from "../experiments/bm07/definition.ts";
import type { PreparedBm07Example } from "../experiments/bm07/session.ts";
import { createBm07TapeBinding } from "../experiments/bm07/tape.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createBm07Host } from "../workers/host/bm07Host.ts";
import { createBm07Recording, measureBm07 } from "../workers/operations/bm07.ts";
import type { LabResponse } from "../workers/protocol/bm07.ts";
import type { WorkerChannel } from "../workers/scheduler/hostScheduler.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function bm07ReplayFixture() {
  const hash = createHash("sha256");
  for (const [path, source] of await evaluatorSources())
    hash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const parameters = { ...BM07_DEFAULTS };
  const recording = await createBm07Recording(parameters, { yieldControl: async () => {} });
  assert.ok(recording.kind === "accepted");
  const measured = await measureBm07(recording.data, parameters, false);
  assert.ok(measured.kind === "accepted");
  const example: PreparedBm07Example = {
    sourceDigest,
    parameters,
    results: measured.data.outputs.map(encodeResult),
    stepIndex: measured.data.stepIndex,
    simulationTime: measured.data.simulationTime,
  };
  return { example, sourceDigest };
}
export type Bm07ReplayFixture = Awaited<ReturnType<typeof bm07ReplayFixture>>;
type ChannelControl = {
  disposed: boolean;
  requests: number;
  results: LabResponse[];
  result: Promise<void>;
  release(): void;
};
let instance = 0;

export function bm07Laboratory(
  fixture: Bm07ReplayFixture,
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
    const host = createBm07Host((message) => {
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
  const binding = createBm07TapeBinding(fixture.example, factory);
  const session = binding.createSession(`bm07-replay-test-${++instance}`);
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

