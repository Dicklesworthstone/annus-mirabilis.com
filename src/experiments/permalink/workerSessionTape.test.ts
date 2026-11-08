import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluatorSources } from "../../../scripts/generate-sr03.mjs";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { encodeResult } from "../results/codec.ts";
import { SR03_DEFAULTS } from "../sr03/definition.ts";
import { validateSr03Parameters } from "../sr03/parameters.ts";
import { decodeSr03Settings, encodeSr03Settings } from "../sr03/permalink.ts";
import type { PreparedSr03Example } from "../sr03/session.ts";
import { createSr03TapeBinding, createSr03WalkthroughTarget } from "../sr03/tape.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { tapeStateDigestV2, tapeStateOf } from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";
import {
  applyWalkthroughCheckpointAsync,
  calculateWalkthroughCheckpointAsync,
} from "./walkthroughActions.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "./workerSessionTape.ts";

// The same source closure and physics owner as the generated example, without writing artifacts
// or making the test depend on a stale generated JSON file.
const sourceHash = createHash("sha256");
for (const [path, source] of await evaluatorSources()) {
  sourceHash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
}
const sourceDigest = `source:sha256:${sourceHash.digest("hex")}`;
const evaluated = await evaluateSr03(SR03_DEFAULTS);
expect(evaluated.kind).toBe("accepted");
const data = evaluated.kind === "accepted" ? evaluated.data : null;
const example: PreparedSr03Example = {
  sourceDigest,
  parameters: SR03_DEFAULTS,
  stepIndex: data?.stepIndex ?? 0,
  simulationTime: data?.simulationTime ?? 0,
  results: data?.outputs.map(encodeResult) ?? [],
};
const catalogue = loadWalkthroughCatalogue();
const walkthrough = catalogue.walkthroughs.find((entry) => entry.tapeId === "the-boost-to-0.6c");
expect(walkthrough).toBeDefined();
const record = validateControlTape(
  parseYaml(
    readFileSync(
      new URL("../../../content/experiments/tapes/the-boost-to-0.6c.yaml", import.meta.url),
      "utf8",
    ),
  ),
);

function checkpoint(index: number): TapeV2 {
  const tape = walkthrough?.checkpoints[index]?.tape;
  expect(tape).toBeDefined();
  expect(tape).not.toBeNull();
  return tape as TapeV2;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type ChannelControl = {
  disposed: boolean;
  result: Promise<void>;
  release(): void;
};
const sessions: WorkerTapeSession[] = [];
let instance = 0;
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

/** Delay transport only: all requests still execute the real SR03 host and numerical owner. */
function laboratory(options: { hold?: (index: number) => boolean; wrongSourceAt?: number } = {}) {
  const channels: ChannelControl[] = [];
  const waiters = new Map<number, ReturnType<typeof deferred<ChannelControl>>>();
  const factory = (): WorkerChannel => {
    const index = channels.length;
    const firstResult = deferred<void>();
    let listener: ((message: unknown) => void) | null = null;
    let held = options.hold?.(index) ?? false;
    const deliveries: (() => void)[] = [];
    const host = createSr03Host(
      (message) => {
        const deliver = () => listener?.(structuredClone(message));
        if (message.messageKind === "result") {
          firstResult.resolve();
          if (held) {
            deliveries.push(deliver);
            return;
          }
        }
        deliver();
      },
      options.wrongSourceAt === index ? `source:sha256:${"0".repeat(64)}` : sourceDigest,
    );
    const control: ChannelControl = {
      disposed: false,
      result: firstResult.promise,
      release() {
        held = false;
        for (const deliver of deliveries.splice(0)) deliver();
      },
    };
    channels.push(control);
    waiters.get(index)?.resolve(control);
    return {
      send(message) {
        void host.receive(structuredClone(message));
      },
      listen(onMessage) {
        listener = onMessage;
        queueMicrotask(() => host.hello());
        return () => {
          listener = null;
        };
      },
      dispose() {
        control.disposed = true;
        host.dispose();
      },
    };
  };
  const binding = createSr03TapeBinding(example, factory);
  const session = binding.createSession(`tape-test-${++instance}`);
  sessions.push(session);
  return {
    binding,
    session,
    channels,
    channel(index: number): Promise<ChannelControl> {
      const found = channels[index];
      if (found) return Promise.resolve(found);
      const pending = deferred<ChannelControl>();
      waiters.set(index, pending);
      return pending.promise;
    },
  };
}

function output(session: WorkerTapeSession, id: string) {
  const found = session.getSnapshot().accepted?.outputs.find((entry) => entry.quantityId === id);
  expect(found?.status).toBe("value");
  return found?.status === "value" ? found.value : null;
}

test("opening a worker walkthrough starts no worker; both authored stops reproduce their own real outputs", async () => {
  const lab = laboratory();
  createSr03WalkthroughTarget(lab.binding, lab.session, () => {});
  expect(lab.channels).toHaveLength(0);
  expect(walkthrough?.checkpoints.map((stop) => stop.actionIndex)).toEqual([0, 2]);
  expect(checkpoint(1).events[0]).toMatchObject({
    paramId: "endpointPairId",
    value: "frame-simultaneous",
    commandClass: "measurement-change",
  });
  expect(checkpoint(0).modelIdentity.artifactDigest).toBe(
    sourceDigest.replace(/^source:/, "host:"),
  );
  for (const index of [0, 1, 0]) {
    const tape = checkpoint(index);
    expect(await restoreWorkerTape(lab.binding, lab.session, tape)).toEqual({ kind: "restored" });
    const accepted = lab.session.getSnapshot().accepted;
    expect(accepted?.final).toBe(true);
    expect(accepted?.actionIndex).toBe(lab.session.getSnapshot().requested?.actionIndex);
    expect(
      tapeStateDigestV2(
        tapeStateOf(accepted?.parameters ?? {}) ?? {},
        tape.acceptedCheckpoint.acceptedActionIndex,
      ),
    ).toBe(tape.acceptedCheckpoint.digest);
    for (const expected of record.checkpoints[index]?.expectedDisplayValues ?? []) {
      const actual = accepted?.outputs.find((entry) => entry.quantityId === expected.outputId);
      expect(actual?.status, expected.label).toBe("value");
      expect(actual?.unit, expected.label).toBe(expected.unit);
      expect(actual?.status === "value" ? actual.value : null, expected.label).toBe(expected.value);
    }
    expect(output(lab.session, "readingsOnRodEnds")).toBe(index === 0 ? 0 : 1);
    expect(output(lab.session, "temporalSeparationKPrime")).toBe(index === 0 ? -7.5 : -6);
    expect(output(lab.session, "measuredLength")).toBe(index === 0 ? 10 : 8);
  }
});

test("a restore waits for preflight and the live worker's final acceptance before reporting success", async () => {
  const lab = laboratory({ hold: () => true });
  const before = lab.session.getSnapshot();
  let completed = false;
  const restoring = restoreWorkerTape(lab.binding, lab.session, checkpoint(1)).then((result) => {
    completed = true;
    return result;
  });
  const trial = await lab.channel(0);
  await trial.result;
  expect(lab.session.getSnapshot()).toBe(before);
  expect(completed).toBe(false);
  trial.release();
  const live = await lab.channel(1);
  await live.result;
  expect(lab.session.getSnapshot().pending).toBe(true);
  expect(lab.session.getSnapshot().accepted).toBe(before.accepted);
  expect(completed).toBe(false);
  live.release();
  expect(await restoring).toEqual({ kind: "restored" });
  expect(output(lab.session, "measuredLength")).toBe(8);
  expect(trial.disposed).toBe(true);
  expect(live.disposed).toBe(false);
});

test("changed identity, bad digest, and an invalid intermediate event preserve the complete live run", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  const tape = checkpoint(1);
  const invalidIntermediate: TapeV2 = {
    ...tape,
    events: [
      { actionIndex: 1, commandClass: "setup-change", paramId: "v", value: 1.2 },
      { actionIndex: 2, commandClass: "setup-change", paramId: "v", value: 0.6 },
      {
        actionIndex: 3,
        commandClass: "measurement-change",
        paramId: "endpointPairId",
        value: "frame-simultaneous",
      },
    ],
    acceptedCheckpoint: {
      ...tape.acceptedCheckpoint,
      acceptedActionIndex: 3,
      digest: tapeStateDigestV2(
        { ...tape.initialConditions, endpointPairId: "frame-simultaneous" },
        3,
      ),
    },
  };
  for (const incompatible of [
    { ...tape, modelIdentity: { ...tape.modelIdentity, modelVersion: 900 } },
    {
      ...tape,
      modelIdentity: { ...tape.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
    },
    {
      ...tape,
      acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: "host:0000000000000000" },
    },
    invalidIntermediate,
  ]) {
    expect((await restoreWorkerTape(lab.binding, lab.session, incompatible)).kind).toBe(
      "not-restored",
    );
    expect(lab.session.getSnapshot()).toBe(before);
    expect(lab.channels).toHaveLength(0);
  }
});

test("an edit during preflight keeps the reader's newer accepted work", async () => {
  const lab = laboratory({ hold: (index) => index === 0 });
  const restoring = restoreWorkerTape(lab.binding, lab.session, checkpoint(1));
  const trial = await lab.channel(0);
  await trial.result;
  expect(await applyWorkerSettings(lab.session, { ...SR03_DEFAULTS, v: 0.2 })).toEqual({
    kind: "restored",
  });
  const newer = lab.session.getSnapshot();
  trial.release();
  expect(await restoring).toMatchObject({ kind: "not-restored" });
  expect(lab.session.getSnapshot()).toBe(newer);
  expect(lab.session.acceptedParameters()).toMatchObject({ v: 0.2 });
});

test("a live worker identity failure preserves the previous accepted result and disposes preflight", async () => {
  const lab = laboratory({ wrongSourceAt: 1 });
  const before = lab.session.getSnapshot().accepted;
  expect((await restoreWorkerTape(lab.binding, lab.session, checkpoint(1))).kind).toBe(
    "not-restored",
  );
  expect(lab.session.getSnapshot().accepted).toBe(before);
  expect(lab.channels[0]?.disposed).toBe(true);
});

test("abort and timeout close a stalled preflight without changing the live run", async () => {
  for (const mode of ["abort", "timeout"] as const) {
    const lab = laboratory({ hold: () => true });
    const before = lab.session.getSnapshot();
    const abort = new AbortController();
    const restoring = restoreWorkerTape(lab.binding, lab.session, checkpoint(1), {
      signal: abort.signal,
      timeoutMs: mode === "timeout" ? 30 : 15_000,
    });
    const trial = await lab.channel(0);
    await trial.result;
    if (mode === "abort") abort.abort();
    expect((await restoring).kind).toBe("not-restored");
    expect(lab.session.getSnapshot()).toBe(before);
    expect(trial.disposed).toBe(true);
    trial.release();
    expect(lab.session.getSnapshot()).toBe(before);
  }
});

test("aborting a live restoration cannot publish a delayed result", async () => {
  const lab = laboratory({ hold: (index) => index === 1 });
  const before = lab.session.getSnapshot().accepted;
  const abort = new AbortController();
  const restoring = restoreWorkerTape(lab.binding, lab.session, checkpoint(1), {
    signal: abort.signal,
  });
  const live = await lab.channel(1);
  await live.result;
  abort.abort();
  expect((await restoring).kind).toBe("not-restored");
  expect(live.disposed).toBe(true);
  expect(lab.session.getSnapshot().accepted).toBe(before);
  live.release();
  expect(lab.session.getSnapshot().accepted).toBe(before);
});

test("concurrent restores and already pending laboratory work are refused without replacing the request", async () => {
  const lab = laboratory({ hold: () => true });
  const restoring = restoreWorkerTape(lab.binding, lab.session, checkpoint(1));
  const trial = await lab.channel(0);
  await trial.result;
  expect((await restoreWorkerTape(lab.binding, lab.session, checkpoint(0))).kind).toBe(
    "not-restored",
  );
  expect(lab.channels).toHaveLength(1);
  trial.release();
  const live = await lab.channel(1);
  await live.result;
  const request = lab.session.getSnapshot().requested;
  expect((await restoreWorkerTape(lab.binding, lab.session, checkpoint(0))).kind).toBe(
    "not-restored",
  );
  expect(lab.session.getSnapshot().requested).toBe(request);
  live.release();
  await restoring;

  // A separate pending ordinary user action also stays in place.
  const pending = laboratory({ hold: () => true });
  const applying = applyWorkerSettings(pending.session, { ...SR03_DEFAULTS, v: 0.2 });
  const owner = await pending.channel(0);
  await owner.result;
  const held = pending.session.getSnapshot();
  expect((await restoreWorkerTape(pending.binding, pending.session, checkpoint(0))).kind).toBe(
    "not-restored",
  );
  expect(pending.session.getSnapshot()).toBe(held);
  owner.release();
  await applying;
});

test("custom events really calculate and presets reset their inactive fields without changing setup", async () => {
  const lab = laboratory();
  const openingRun = lab.session.getSnapshot().accepted?.runId;
  const custom = { ...SR03_DEFAULTS, endpointPairId: "custom", customX2: 8 };
  expect(await applyWorkerSettings(lab.session, custom)).toEqual({ kind: "restored" });
  expect(output(lab.session, "readingsOnRodEnds")).toBe(1);
  expect(output(lab.session, "measuredLength")).toBe(8);
  expect(lab.session.getSnapshot().accepted?.runId).toBe(openingRun);
  const revision = lab.session.getSnapshot().accepted?.revisions.measurement;
  expect(await restoreWorkerTape(lab.binding, lab.session, checkpoint(0))).toEqual({
    kind: "restored",
  });
  expect(lab.session.acceptedParameters()).toEqual(SR03_DEFAULTS);
  expect(lab.session.getSnapshot().accepted?.runId).toBe(openingRun);
  expect(lab.session.getSnapshot().accepted?.revisions.measurement).toBeGreaterThan(revision ?? 0);
  expect(output(lab.session, "readingsOnRodEnds")).toBe(0);
  expect(output(lab.session, "measuredLength")).toBe(10);

  const { customT1: _t1, customX1: _x1, customT2: _t2, customX2: _x2, ...legacy } = SR03_DEFAULTS;
  expect(validateSr03Parameters(legacy)).toMatchObject({ kind: "accepted", data: SR03_DEFAULTS });
  expect(validateSr03Parameters({ ...legacy, endpointPairId: "custom" })).toMatchObject({
    kind: "accepted",
    data: { ...SR03_DEFAULTS, endpointPairId: "custom" },
  });
  expect(decodeSr03Settings(encodeSr03Settings(legacy))).toMatchObject({
    kind: "settings",
    parameters: SR03_DEFAULTS,
  });
});

test("walkthrough actions wait for accepted worker results; an explicit new calculation stays distinct", async () => {
  if (!walkthrough) return;
  const lab = laboratory({ hold: (index) => index === 1 });
  const accepted: object[] = [];
  const target = createSr03WalkthroughTarget(lab.binding, lab.session, (parameters) =>
    accepted.push(parameters),
  );
  const restoring = applyWalkthroughCheckpointAsync(target, walkthrough, 1);
  const live = await lab.channel(1);
  await live.result;
  expect(accepted).toHaveLength(0);
  live.release();
  expect((await restoring).kind).toBe("replayed");
  expect(accepted).toEqual([{ ...SR03_DEFAULTS, endpointPairId: "frame-simultaneous" }]);
  const restoredRun = lab.session.getSnapshot().accepted?.runId;
  expect((await calculateWalkthroughCheckpointAsync(target, walkthrough, 1)).kind).toBe("new-run");
  const sameSettingsRun = lab.session.getSnapshot().accepted?.runId;
  expect(sameSettingsRun).not.toBe(restoredRun);
  expect(lab.session.getSnapshot().accepted?.parentRunId).toBe(restoredRun);
  expect((await calculateWalkthroughCheckpointAsync(target, walkthrough, 0)).kind).toBe("new-run");
  expect(lab.session.getSnapshot().accepted?.runId).not.toBe(sameSettingsRun);
  expect(lab.session.getSnapshot().accepted?.parentRunId).toBe(sameSettingsRun);
  expect(output(lab.session, "measuredLength")).toBe(10);
});
