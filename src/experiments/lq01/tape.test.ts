import { afterAll, afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluatorSources } from "../../../scripts/generate-wave-description.mjs";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import { evaluateLq01 } from "../../workers/operations/lq01.ts";
import type { WorkerChannel } from "../../workers/scheduler/lq01Scheduler.ts";
import { encodeTapePermalink } from "../permalink/codec.ts";
import { draftTapeForSettings, loadDraftTapeFromUrl } from "../permalink/draftTape.ts";
import { tapeStateDigestV2, tapeStateOf } from "../permalink/sessionTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import {
  applyWalkthroughCheckpointAsync,
  calculateWalkthroughCheckpointAsync,
} from "../permalink/walkthroughActions.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { encodeResult } from "../results/codec.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { LQ01_DEFAULTS, type Lq01Parameters } from "./definition.ts";
import { decodeLq01Settings, encodeLq01Settings } from "./permalink.ts";
import type { PreparedLq01Example } from "./session.ts";
import { createLq01TapeBinding, createLq01WalkthroughTarget } from "./tape.ts";

const logger = new TestLogger("lq01-worker-walkthroughs");
afterAll(() => logger.flush());
function passed(testId: string) {
  logger.log({ testId, instrumentId: "lq-01", outcome: "passed" });
}

// Hash the generator's real owner closure, without rewriting any generated artifact in a test.
const sourceHash = createHash("sha256");
for (const [path, source] of await evaluatorSources()) {
  sourceHash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
}
const sourceDigest = `source:sha256:${sourceHash.digest("hex")}`;
const evaluated = await evaluateLq01(LQ01_DEFAULTS);
if (evaluated.kind !== "accepted") throw new Error("The wave example must evaluate.");
const example: PreparedLq01Example = {
  sourceDigest,
  parameters: LQ01_DEFAULTS,
  stepIndex: evaluated.data.stepIndex,
  simulationTime: evaluated.data.simulationTime,
  results: evaluated.data.outputs.map(encodeResult),
};
const catalogue = loadWalkthroughCatalogue();
const authored = ["waves-in-and-out-of-step", "one-source-larger-spheres"].map((tapeId) => {
  const walkthrough = catalogue.walkthroughs.find((entry) => entry.tapeId === tapeId);
  if (!walkthrough) throw new Error(`The catalogue must expose ${tapeId}.`);
  const record = validateControlTape(
    parseYaml(
      readFileSync(
        new URL(`../../../content/experiments/tapes/${tapeId}.yaml`, import.meta.url),
        "utf8",
      ),
    ),
  );
  return { walkthrough, record };
});

function checkpoint(sequence: number, stop: number): TapeV2 {
  const tape = authored[sequence]?.walkthrough.checkpoints[stop]?.tape;
  if (!tape) throw new Error(`Missing replayable wave checkpoint ${sequence}:${stop}.`);
  return tape;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type ChannelControl = { disposed: boolean; result: Promise<void>; release(): void };
const sessions: WorkerTapeSession[] = [];
let instance = 0;
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

/** Only transport delivery is delayed; every request executes the real host and wave owner. */
function laboratory(options: { hold?: (index: number) => boolean; wrongSourceAt?: number } = {}) {
  const channels: ChannelControl[] = [];
  const waiters = new Map<number, ReturnType<typeof deferred<ChannelControl>>>();
  const factory = (): WorkerChannel => {
    const index = channels.length;
    const firstResult = deferred<void>();
    let listener: ((message: unknown) => void) | null = null;
    let held = options.hold?.(index) ?? false;
    const deliveries: (() => void)[] = [];
    const host = createLq01Host(
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
  const binding = createLq01TapeBinding(example, factory);
  const session = binding.createSession(`wave-tape-test-${++instance}`);
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

function output(session: WorkerTapeSession, id: string): number {
  const found = session.getSnapshot().accepted?.outputs.find((entry) => entry.quantityId === id);
  if (found?.status !== "value" || typeof found.value !== "number") {
    throw new Error(`The wave owner did not publish scalar ${id}.`);
  }
  return found.value;
}

for (const [sequence, { walkthrough, record }] of authored.entries()) {
  test(`${walkthrough.tapeId} reproduces every real checkpoint forward and backward`, async () => {
    const lab = laboratory();
    createLq01WalkthroughTarget(lab.binding, lab.session, () => {});
    expect(lab.channels).toHaveLength(0);
    expect(walkthrough.checkpoints.map((stop) => stop.actionIndex)).toEqual([0, 1, 2]);
    expect(checkpoint(sequence, 0).modelIdentity.artifactDigest).toBe(
      sourceDigest.replace(/^source:/, "host:"),
    );
    for (const index of [0, 1, 2, 1, 0]) {
      const tape = checkpoint(sequence, index);
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
        assert.ok(expected.outputId, "Every recorded number must name its accepted output.");
        const actual = accepted?.outputs.find((entry) => entry.quantityId === expected.outputId);
        expect(actual?.status, expected.label).toBe("value");
        expect(actual?.unit, expected.label).toBe(expected.unit);
        expect(output(lab.session, expected.outputId), expected.label).toBeCloseTo(
          expected.value,
          12,
        );
      }
      // Independent analytic checks, not a comparison against values produced by the same owner.
      const p = lab.session.acceptedParameters() as Lq01Parameters;
      if (p.mode === "interference") {
        expect(output(lab.session, "centerIntensity")).toBeCloseTo(
          p.A1 ** 2 + p.A2 ** 2 + 2 * p.A1 * p.A2 * Math.cos(p.delta),
          12,
        );
        expect(output(lab.session, "fringeVisibility")).toBeCloseTo(
          (2 * p.A1 * p.A2) / (p.A1 ** 2 + p.A2 ** 2),
          12,
        );
      } else {
        expect(output(lab.session, "pointSourceIntensity")).toBeCloseTo(
          p.P / (4 * Math.PI * p.r ** 2),
          12,
        );
        expect(output(lab.session, "shellPower")).toBeCloseTo(p.P, 12);
      }
    }
    passed(walkthrough.tapeId);
  });
}

test("source-pinned shared settings stay draft-only and walkthrough URLs are not legacy errors", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  const settings = { ...LQ01_DEFAULTS, delta: Math.PI, A2: 0.5 };
  const tape = draftTapeForSettings(lab.binding, settings);
  if (!tape) throw new Error("Valid wave settings must produce a share link.");
  expect(tape.modelIdentity.artifactDigest).toBe(sourceDigest.replace(/^source:/, "host:"));
  const href = `https://annus-mirabilis.com/lab/lq-01/?tape=${encodeTapePermalink(tape)}`;
  expect(await loadDraftTapeFromUrl(lab.binding, href)).toEqual({ kind: "loaded", settings });
  const changedSource = {
    ...tape,
    modelIdentity: { ...tape.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
  };
  expect(
    (
      await loadDraftTapeFromUrl(
        lab.binding,
        `https://annus-mirabilis.com/lab/lq-01/?tape=${encodeTapePermalink(changedSource)}`,
      )
    ).kind,
  ).toBe("not-restored");
  expect(decodeLq01Settings(new URL(href).search).kind).toBe("absent");
  expect(decodeLq01Settings("?walkthrough=waves-in-and-out-of-step&checkpoint=2").kind).toBe(
    "absent",
  );
  expect(decodeLq01Settings("?lq=1&delta=bad").kind).toBe("invalid");
  expect(decodeLq01Settings(encodeLq01Settings(settings))).toEqual({
    kind: "settings",
    parameters: settings,
  });
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot()).toBe(before);
  passed("source-pinned-draft-links");
});

test("the target waits for isolated preflight and exact live acceptance before updating the form", async () => {
  const lab = laboratory({ hold: () => true });
  const before = lab.session.getSnapshot();
  const accepted: Lq01Parameters[] = [];
  let starts = 0;
  const target = createLq01WalkthroughTarget(
    lab.binding,
    lab.session,
    (parameters) => accepted.push(parameters),
    () => starts++,
  );
  const walkthrough = authored[0]?.walkthrough;
  if (!walkthrough) throw new Error("Missing wave walkthrough.");
  const restoring = applyWalkthroughCheckpointAsync(target, walkthrough, 2);
  const trial = await lab.channel(0);
  await trial.result;
  expect(starts).toBe(1);
  expect(lab.session.getSnapshot()).toBe(before);
  expect(accepted).toHaveLength(0);
  trial.release();
  const live = await lab.channel(1);
  await live.result;
  expect(lab.session.getSnapshot().pending).toBe(true);
  expect(lab.session.getSnapshot().accepted).toBe(before.accepted);
  expect(accepted).toHaveLength(0);
  live.release();
  expect((await restoring).kind).toBe("replayed");
  expect(accepted).toEqual([{ ...LQ01_DEFAULTS, delta: Math.PI, A2: 0.5 }]);
  expect(output(lab.session, "centerIntensity")).toBe(0.25);
  expect(trial.disposed).toBe(true);
  expect(live.disposed).toBe(false);
  passed("exact-worker-acceptance");
});

test("identity, digest and invalid intermediate settings are refused without touching the live run", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  const tape = checkpoint(0, 2);
  const invalidIntermediate: TapeV2 = {
    ...tape,
    events: [
      { actionIndex: 1, commandClass: "setup-change", paramId: "A2", value: -1 },
      ...tape.events.map((event) => ({ ...event, actionIndex: event.actionIndex + 1 })),
    ],
    acceptedCheckpoint: {
      ...tape.acceptedCheckpoint,
      acceptedActionIndex: 3,
      digest: tapeStateDigestV2({ ...LQ01_DEFAULTS, delta: Math.PI, A2: 0.5 }, 3),
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
  passed("preflight-refusals-preserve-run");
});

test("a reader's newer calculation during preflight survives a delayed checkpoint", async () => {
  const lab = laboratory({ hold: (index) => index === 0 });
  const restoring = restoreWorkerTape(lab.binding, lab.session, checkpoint(0, 2));
  const trial = await lab.channel(0);
  await trial.result;
  expect(await applyWorkerSettings(lab.session, { ...LQ01_DEFAULTS, A1: 2 })).toEqual({
    kind: "restored",
  });
  const newer = lab.session.getSnapshot();
  trial.release();
  expect((await restoring).kind).toBe("not-restored");
  expect(lab.session.getSnapshot()).toBe(newer);
  expect(output(lab.session, "centerIntensity")).toBe(9);
  passed("newer-calculation-wins");
});

test("cancelling a pending live restore rejects late results and never updates the draft", async () => {
  const lab = laboratory({ hold: (index) => index === 1 });
  const before = lab.session.getSnapshot().accepted;
  const accepted: Lq01Parameters[] = [];
  const target = createLq01WalkthroughTarget(lab.binding, lab.session, (parameters) =>
    accepted.push(parameters),
  );
  const abort = new AbortController();
  const restoring = target.restore(checkpoint(0, 1), abort.signal);
  const live = await lab.channel(1);
  await live.result;
  abort.abort();
  expect((await restoring).kind).toBe("not-restored");
  expect(live.disposed).toBe(true);
  expect(lab.session.getSnapshot().accepted).toBe(before);
  live.release();
  expect(lab.session.getSnapshot().accepted).toBe(before);
  expect(accepted).toHaveLength(0);
  passed("cancelled-live-result");
});

test("explicit calculation creates one new run with complete settings even for phase-only changes", async () => {
  const lab = laboratory();
  const accepted: Lq01Parameters[] = [];
  const target = createLq01WalkthroughTarget(lab.binding, lab.session, (parameters) =>
    accepted.push(parameters),
  );
  const walkthrough = authored[0]?.walkthrough;
  if (!walkthrough) throw new Error("Missing wave walkthrough.");
  for (const stop of [0, 1, 1, 2]) {
    const before = lab.session.getSnapshot().accepted;
    expect((await calculateWalkthroughCheckpointAsync(target, walkthrough, stop)).kind).toBe(
      "new-run",
    );
    const after = lab.session.getSnapshot().accepted;
    expect(after?.runId).not.toBe(before?.runId);
    expect(after?.parentRunId).toBe(before?.runId);
    expect(after?.actionIndex).toBe((before?.actionIndex ?? 0) + 1);
    expect(lab.session.acceptedParameters()).toEqual({
      ...LQ01_DEFAULTS,
      delta: stop === 0 ? 0 : Math.PI,
      A2: stop === 2 ? 0.5 : 1,
    });
    expect(output(lab.session, "centerIntensity")).toBe(stop === 0 ? 4 : stop === 2 ? 0.25 : 0);
  }
  expect(accepted).toHaveLength(4);
  passed("explicit-new-run-lineage");
});

test("a live worker with a changed source cannot replace the accepted example", async () => {
  const lab = laboratory({ wrongSourceAt: 1 });
  const before = lab.session.getSnapshot().accepted;
  const accepted: Lq01Parameters[] = [];
  const target = createLq01WalkthroughTarget(lab.binding, lab.session, (parameters) =>
    accepted.push(parameters),
  );
  expect((await target.restore(checkpoint(0, 2))).kind).toBe("not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(before);
  expect(lab.channels[0]?.disposed).toBe(true);
  expect(accepted).toHaveLength(0);
  passed("wrong-worker-source");
});
