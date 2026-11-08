import { afterAll, afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import {
  bm01Laboratory,
  bm01ReplayFixture,
  deferred,
  recordBm01Checkpoints,
} from "../../testing/bm01ReplayHarness.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { createBm01Recording, HOST_TRACER_RECORDER } from "../../workers/operations/bm01.ts";
import { parseU64 } from "../identity/u64.ts";
import {
  decodeTapePermalink,
  encodeTapePermalink,
  MAX_PERMALINK_URL_LENGTH,
} from "../permalink/codec.ts";
import { draftTapeForSettings, loadDraftTapeFromUrl } from "../permalink/draftTape.ts";
import { tapeStateDigestV2 } from "../permalink/sessionTape.ts";
import type { TapeScientificCheckpoint, TapeV2 } from "../permalink/types.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { validateControlTape } from "../tapes/schema.ts";
import {
  BM01_DEFAULTS,
  BM01_FRANKENSIM_RECORDER_OWNER,
  BM01_HOST_RECORDER_OWNER,
  type Bm01Parameters,
} from "./definition.ts";
import { decodeBm01Settings } from "./permalink.ts";
import { createBm01RecordingCheckpoint } from "./recordingCheckpoint.ts";
import { createBm01WalkthroughTarget } from "./tape.ts";

const logger = new TestLogger("bm01-scientific-worker-walkthrough");
afterAll(() => logger.flush());
const passed = (testId: string) => logger.log({ testId, instrumentId: "bm-01", outcome: "passed" });
const fixture = await bm01ReplayFixture();
const record = validateControlTape(
  parseYaml(
    readFileSync(
      new URL("../../../content/experiments/tapes/einstein-0-8-micron.yaml", import.meta.url),
      "utf8",
    ),
  ),
);
const walkthrough = loadWalkthroughCatalogue().walkthroughs.find(
  (entry) => entry.tapeId === record.tapeId,
);
assert.ok(walkthrough);
const sessions: WorkerTapeSession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});
function laboratory(options: Parameters<typeof bm01Laboratory>[1] = {}) {
  const lab = bm01Laboratory(fixture, options);
  sessions.push(lab.session);
  return lab;
}
function checkpoint(index: number): TapeV2 {
  const tape = walkthrough?.checkpoints[index]?.tape;
  assert.ok(tape, "The authored Brownian stop must be replayable.");
  return tape;
}
function scalar(session: WorkerTapeSession, id: string): number {
  const output = session.getSnapshot().accepted?.outputs.find((value) => value.quantityId === id);
  assert.ok(output?.status === "value" && typeof output.value === "number", id);
  return output.value;
}
function changedState(tape: TapeV2, patch: Partial<TapeScientificCheckpoint>): TapeV2 {
  assert.ok(tape.acceptedCheckpoint.scientificState);
  return {
    ...tape,
    acceptedCheckpoint: {
      ...tape.acceptedCheckpoint,
      scientificState: { ...tape.acceptedCheckpoint.scientificState, ...patch },
    },
  };
}

test("the authored 1-second and 60-second stops reproduce real complete trajectories forward and backward", async () => {
  const lab = laboratory();
  createBm01WalkthroughTarget(lab.binding, lab.session, () => {});
  expect(lab.channels).toHaveLength(0);
  expect(checkpoint(0).modelIdentity.artifactDigest).toBe(
    fixture.sourceDigest.replace(/^source:/, "host:"),
  );
  let run: string | undefined;
  let firstSample: number | undefined;
  for (const stop of [0, 1, 0, 1]) {
    const tape = checkpoint(stop);
    expect(tape.acceptedCheckpoint.scientificState?.streamPositions).toHaveLength(300);
    expect(tape.acceptedCheckpoint.scientificState?.stepIndex).toBe(3000);
    expect(tape.acceptedCheckpoint.scientificState?.simulatedTime).toBe(60);
    const href = `/lab/bm-01/?tape=${encodeTapePermalink(tape)}`;
    expect(href.length).toBeLessThanOrEqual(MAX_PERMALINK_URL_LENGTH);
    const decoded = decodeTapePermalink(href);
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") throw new Error("The recorded URL must decode.");
    expect(decoded.tape).toEqual(tape);
    expect(await restoreWorkerTape(lab.binding, lab.session, decoded.tape)).toEqual({
      kind: "restored",
    });
    const accepted = lab.session.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted.final).toBe(true);
    expect(accepted.actionIndex).toBe(lab.session.getSnapshot().requested?.actionIndex);
    if (run) expect(accepted.runId).toBe(run);
    run = accepted.runId;
    const p = lab.session.acceptedParameters() as Bm01Parameters;
    expect(p.constantSetId).toBe("einstein-1905-brownian-printed");
    expect(p.interval).toBe(stop === 0 ? 1 : 60);
    // Independent arithmetic over historical R/N, not a second call to the production model.
    const diffusion = ((8.31 / 6e23) * 290.15) / (6 * Math.PI * 0.00135 * 5e-7);
    expect(scalar(lab.session, "diffusionCoefficient")).toBe(diffusion);
    expect(scalar(lab.session, "rmsDisplacement1d")).toBe(Math.sqrt(2 * diffusion * p.interval));
    expect(scalar(lab.session, "lambdaX60s") / scalar(lab.session, "lambdaX1s")).toBeCloseTo(
      Math.sqrt(60),
      13,
    );
    expect(scalar(lab.session, "recordingDraws")).toBe(1_800_000);
    for (const expected of record.checkpoints[stop]?.expectedDisplayValues ?? []) {
      assert.ok(expected.outputId);
      const output = accepted.outputs.find((value) => value.quantityId === expected.outputId);
      expect(output?.unit).toBe(expected.unit);
      expect(scalar(lab.session, expected.outputId)).toBe(expected.value);
    }
    if (stop === 0) {
      if (firstSample !== undefined) expect(scalar(lab.session, "sampleRms")).toBe(firstSample);
      firstSample = scalar(lab.session, "sampleRms");
    }
  }
  const live = lab.channels[1];
  assert.ok(live);
  expect(live.recordings).toBe(1);
  expect(live.requests).toBe(4);
  const latentDigests = live.results.flatMap((message) =>
    message.result.kind === "accepted" ? [message.result.data.recordingCheckpoint?.digest] : [],
  );
  expect(new Set(latentDigests).size).toBe(1);
  expect(scalar(lab.session, "reusedRecording")).toBe(1);
  expect(
    lab.channels.filter((channel) => channel !== live).every((channel) => channel.disposed),
  ).toBe(true);
  passed("authored-full-recording-forward-backward");
}, 15_000);

test("ordinary source-pinned URLs keep constants, exact 64-bit seed and grid as a draft without a worker", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  for (const seed of ["9007199254740993", "18446744073709551615"]) {
    const settings = {
      ...BM01_DEFAULTS,
      constantSetId: "einstein-1905-brownian-printed",
      seed,
      M: 4,
      H: 1,
    };
    const tape = draftTapeForSettings(lab.binding, settings);
    assert.ok(tape);
    expect(tape.seed).toBe(seed);
    expect(tape.replayGrid).toEqual({ baseSpacing: settings.h, horizon: settings.H });
    expect(tape.modelIdentity.artifactDigest).toBe(
      fixture.sourceDigest.replace(/^source:/, "host:"),
    );
    const href = `https://annus-mirabilis.com/lab/bm-01/?tape=${encodeTapePermalink(tape)}`;
    expect(await loadDraftTapeFromUrl(lab.binding, href)).toEqual({ kind: "loaded", settings });
    const forged = { ...tape, seed: parseU64("0") };
    expect(
      (
        await loadDraftTapeFromUrl(
          lab.binding,
          `https://annus-mirabilis.com/lab/bm-01/?tape=${encodeTapePermalink(forged)}`,
        )
      ).kind,
    ).toBe("not-restored");
    expect(decodeBm01Settings(new URL(href).search).kind).toBe("absent");
  }
  expect(decodeBm01Settings("?walkthrough=einstein-0-8-micron&checkpoint=2").kind).toBe("absent");
  expect(lab.session.getSnapshot()).toBe(before);
  expect(lab.channels).toHaveLength(0);
  passed("exact-draft-identity-no-autoplay");
});

test("source, constants, seed, grid, stream positions, command classes and incomplete histories refuse before a worker", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  const tape = checkpoint(1);
  const metadata = tape.acceptedCheckpoint.scientificState;
  assert.ok(metadata);
  const { artifactDigest: _source, ...unidentifiedModel } = tape.modelIdentity;
  const { seed: _seed, ...incompleteSetup } = tape.initialConditions;
  const broken: TapeV2[] = [
    { ...tape, modelIdentity: { ...tape.modelIdentity, modelId: "another-model" } },
    { ...tape, modelIdentity: { ...tape.modelIdentity, modelVersion: 2 } },
    {
      ...tape,
      modelIdentity: { ...tape.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
    },
    { ...tape, modelIdentity: unidentifiedModel },
    { ...tape, constantSetId: "modern-si-2019" },
    { ...tape, seed: parseU64("9007199254740993") },
    { ...tape, streamVersion: 2 },
    { ...tape, allocationId: "another-allocation" },
    { ...tape, replayGrid: { baseSpacing: 0.01, horizon: 60 } },
    { ...tape, replayGrid: { baseSpacing: 0.02, horizon: 30 } },
    { ...tape, initialConditions: incompleteSetup },
    {
      ...tape,
      events: [
        { actionIndex: 1, commandClass: "measurement-change", paramId: "interval", value: -1 },
        ...tape.events.slice(1),
      ],
    },
    { ...tape, events: tape.events.map((event) => ({ ...event, commandClass: "setup-change" })) },
    {
      ...tape,
      events: [
        { actionIndex: 1, commandClass: "measurement-change", paramId: "unknown", value: 1 },
        ...tape.events.slice(1),
      ],
    },
    { ...tape, events: tape.events.map((event) => ({ ...event, previousValue: 999 })) },
    { ...tape, acceptedCheckpoint: { ...tape.acceptedCheckpoint, acceptedActionIndex: 3 } },
    { ...tape, acceptedCheckpoint: { ...tape.acceptedCheckpoint, scientificState: undefined } },
    changedState(tape, { checkpointVersion: 2 }),
    changedState(tape, { streamSemanticsVersion: 2 }),
    changedState(tape, { stepIndex: 2999 }),
    changedState(tape, { simulatedTime: 1 }),
    changedState(tape, { seed: parseU64("1906") }),
    changedState(tape, { streamPositions: [] }),
    ...["tile", "index", "allocationId", "streamKernelId"].map((key) =>
      changedState(tape, {
        streamPositions: metadata.streamPositions.map((position, index) =>
          index === 0
            ? {
                ...position,
                [key]: key === "tile" || key === "index" ? parseU64("999") : "another-stream",
              }
            : position,
        ),
      }),
    ),
    {
      ...tape,
      acceptedCheckpoint: {
        ...tape.acceptedCheckpoint,
        digest: tapeStateDigestV2(tape.initialConditions, 2),
      },
    },
  ];
  for (const invalid of broken) {
    expect((await restoreWorkerTape(lab.binding, lab.session, invalid)).kind).toBe("not-restored");
    expect(lab.session.getSnapshot()).toBe(before);
    expect(lab.channels).toHaveLength(0);
  }
  passed("scientific-identity-and-prefix-refusals");
});

test("a damaged scientific digest fails isolated preflight and preserves the complete live state", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  const tape = checkpoint(0);
  const outcome = await restoreWorkerTape(lab.binding, lab.session, {
    ...tape,
    acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: `host:sha256:${"0".repeat(64)}` },
  });
  expect(outcome.kind).toBe("not-restored");
  if (outcome.kind === "not-restored") expect(outcome.notice).toContain("scientific results");
  expect(lab.session.getSnapshot()).toBe(before);
  expect(lab.channels).toHaveLength(1);
  expect(lab.channels[0]?.disposed).toBe(true);
  passed("preflight-digest-keeps-live-state");
});

test("a different live result or latent checksum is rejected before it can replace accepted numbers", async () => {
  for (const corrupt of ["sample", "latent"]) {
    const lab = laboratory({
      transform(message, channel) {
        if (channel === 1 && message.result.kind === "accepted") {
          if (corrupt === "latent") {
            const checkpoint = message.result.data.recordingCheckpoint;
            assert.ok(checkpoint);
            return {
              ...message,
              result: {
                kind: "accepted",
                data: {
                  ...message.result.data,
                  recordingCheckpoint: { ...checkpoint, digest: `host:sha256:${"0".repeat(64)}` },
                },
              },
            };
          }
          return {
            ...message,
            result: {
              kind: "accepted",
              data: {
                ...message.result.data,
                outputs: message.result.data.outputs.map((output) =>
                  output.quantityId === "sampleRms" &&
                  output.status === "value" &&
                  typeof output.value === "number"
                    ? { ...output, value: output.value + 1e-6 }
                    : output,
                ),
              },
            },
          };
        }
        return message;
      },
    });
    const before = lab.session.getSnapshot().accepted;
    expect((await restoreWorkerTape(lab.binding, lab.session, checkpoint(0))).kind).toBe(
      "not-restored",
    );
    expect(lab.session.getSnapshot().accepted).toBe(before);
    expect(lab.session.getSnapshot().outcome?.outcome).toBe("invariant-violation");
    expect(lab.session.getSnapshot().pending).toBe(false);
  }
  passed("live-scientific-guard-before-publication");
}, 15_000);

test("host fallback refuses bitwise reproduction and an explicit current-model calculation creates new lineage", async () => {
  const lab = laboratory({ recorder: () => HOST_TRACER_RECORDER });
  const before = lab.session.getSnapshot();
  const tape = checkpoint(0);
  const outcome = await restoreWorkerTape(lab.binding, lab.session, tape);
  expect(outcome.kind).toBe("not-restored");
  if (outcome.kind === "not-restored")
    expect(outcome.notice).toContain("different normal transform");
  expect(lab.session.getSnapshot()).toBe(before);
  let callbacks = 0;
  const target = createBm01WalkthroughTarget(lab.binding, lab.session, () => {
    callbacks++;
  });
  const current = { ...BM01_DEFAULTS, M: 4, H: 1, interval: 0.2, d: 3, statistic: "mean-square" };
  assert.ok(target.calculate);
  expect(await target.calculate(current)).toEqual({ kind: "calculated" });
  const accepted = lab.session.getSnapshot().accepted;
  expect(accepted?.runId).not.toBe(before.accepted?.runId);
  expect(accepted?.parentRunId).toBe(before.accepted?.runId);
  expect(accepted?.parameters).toEqual(current);
  expect(accepted?.outputs.find((output) => output.quantityId === "tracerPositions")?.ownerId).toBe(
    BM01_HOST_RECORDER_OWNER,
  );
  expect(callbacks).toBe(1);
  passed("honest-fallback-and-new-run-lineage");
}, 15_000);

test("preflight and live delivery cannot announce success before acceptance, and cancellation drops late replies", async () => {
  for (const held of [0, 1]) {
    const lab = laboratory({ hold: (channel) => channel === held });
    const before = lab.session.getSnapshot().accepted;
    const controller = new AbortController();
    let callbacks = 0;
    let completed = false;
    const target = createBm01WalkthroughTarget(lab.binding, lab.session, () => {
      callbacks++;
    });
    const work = target.restore(checkpoint(0), controller.signal).then((outcome) => {
      completed = true;
      return outcome;
    });
    const channel = await lab.channel(held);
    await channel.result;
    expect(completed).toBe(false);
    expect(callbacks).toBe(0);
    expect(lab.session.getSnapshot().accepted).toBe(before);
    controller.abort();
    expect((await work).kind).toBe("not-restored");
    channel.release();
    await Promise.resolve();
    expect(lab.session.getSnapshot().accepted).toBe(before);
    expect(callbacks).toBe(0);
    expect(channel.disposed).toBe(true);
  }
  passed("no-early-success-and-late-cancelled-replies");
}, 15_000);

test("cancelling during asynchronous publication verification preserves the prior snapshot", async () => {
  const lab = laboratory();
  const started = deferred<void>();
  const finish = deferred<void>();
  const controller = new AbortController();
  const before = lab.session.getSnapshot().accepted;
  const work = applyWorkerSettings(
    lab.session,
    { ...BM01_DEFAULTS, M: 4, H: 1 },
    {
      signal: controller.signal,
      verifyPublication: async () => {
        started.resolve();
        await finish.promise;
        return null;
      },
    },
  );
  await started.promise;
  expect(lab.session.getSnapshot().pending).toBe(true);
  expect(lab.session.getSnapshot().accepted).toBe(before);
  controller.abort();
  expect((await work).kind).toBe("not-restored");
  finish.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(lab.session.getSnapshot().accepted).toBe(before);
  expect(lab.channels[0]?.disposed).toBe(true);
  passed("cancel-while-scientific-hash-awaits");
});

test("a subscriber cancelling synchronously while a request is issued cannot leave a worker publishing later", async () => {
  const lab = laboratory();
  const controller = new AbortController();
  const before = lab.session.getSnapshot().accepted;
  const unsubscribe = lab.session.subscribe(() => {
    if (lab.session.getSnapshot().pending) controller.abort();
  });
  try {
    const outcome = await applyWorkerSettings(
      lab.session,
      { ...BM01_DEFAULTS, M: 4, H: 1, interval: 0.4 },
      { signal: controller.signal },
    );
    expect(outcome.kind).toBe("not-restored");
    expect(lab.session.getSnapshot().pending).toBe(false);
    expect(lab.session.getSnapshot().accepted).toBe(before);
    expect(lab.channels.every((channel) => channel.disposed)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lab.session.getSnapshot().accepted).toBe(before);
  } finally {
    unsubscribe();
  }
  passed("synchronous-subscriber-cancellation");
});

test("a synchronous newer request owns every command group and cannot be overwritten or scheduled by the outer apply", async () => {
  for (const stage of ["input", "measurement", "estimator", "new-run"]) {
    const lab = laboratory();
    const base = fixture.example.parameters;
    const older =
      stage === "input"
        ? { ...base, T: 310, interval: 0.4, statistic: "mean" }
        : stage === "measurement"
          ? { ...base, interval: 0.4, statistic: "mean" }
          : stage === "estimator"
            ? { ...base, statistic: "mean" }
            : { ...base, interval: 0.4, statistic: "mean" };
    const newer = { ...base, T: 315, interval: 0.6, statistic: "mean-square" };
    let entered = false;
    let newerWork: ReturnType<typeof applyWorkerSettings> | undefined;
    const unsubscribe = lab.session.subscribe(() => {
      if (!entered && lab.session.getSnapshot().pending) {
        entered = true;
        newerWork = applyWorkerSettings(lab.session, newer);
      }
    });
    try {
      const result =
        stage === "new-run" ? lab.session.startNewRun?.(older) : lab.session.apply(older);
      expect(result).toMatchObject({ kind: "outcome", outcome: { outcome: "superseded" } });
      assert.ok(newerWork);
      expect(await newerWork).toEqual({ kind: "restored" });
      expect(lab.session.acceptedParameters()).toEqual(newer);
      expect(lab.session.getSnapshot().requested?.parameters).toEqual(newer);
      expect(lab.channels).toHaveLength(1);
      expect(lab.channels[0]?.requests).toBe(1);
    } finally {
      unsubscribe();
    }
  }
  passed("reentrant-command-group-ownership");
});

test("a stalled checkpoint times out and an edit during preflight retains the newer accepted trial", async () => {
  const stalled = laboratory({ hold: () => true });
  const original = stalled.session.getSnapshot();
  expect(
    (await restoreWorkerTape(stalled.binding, stalled.session, checkpoint(0), { timeoutMs: 1 }))
      .kind,
  ).toBe("not-restored");
  expect(stalled.session.getSnapshot()).toBe(original);
  expect(stalled.channels[0]?.disposed).toBe(true);
  const lab = laboratory({ hold: (channel) => channel === 0 });
  const replay = restoreWorkerTape(lab.binding, lab.session, checkpoint(0));
  const preflight = await lab.channel(0);
  await preflight.result;
  const newer = { ...BM01_DEFAULTS, M: 4, H: 1, interval: 0.4 };
  expect(await applyWorkerSettings(lab.session, newer)).toEqual({ kind: "restored" });
  const accepted = lab.session.getSnapshot().accepted;
  preflight.release();
  expect((await replay).kind).toBe("not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.acceptedParameters()).toEqual(newer);
  passed("timeout-and-newer-live-work");
}, 15_000);

test("large seeds reproduce distinct actual trajectories and survive scientific tape URLs without number coercion", async () => {
  const digests = new Set<string>();
  for (const seed of ["9007199254740992", "9007199254740993", "18446744073709551615"]) {
    const stops = await recordBm01Checkpoints(
      fixture,
      { ...BM01_DEFAULTS, M: 4, H: 0.04, interval: 0.04, seed },
      [0.04],
    );
    const stop = stops[0];
    assert.ok(stop);
    const decoded = decodeTapePermalink(encodeTapePermalink(stop.tape));
    assert.ok(decoded.kind === "success");
    const lab = laboratory();
    expect(await restoreWorkerTape(lab.binding, lab.session, decoded.tape)).toEqual({
      kind: "restored",
    });
    expect((lab.session.acceptedParameters() as Bm01Parameters).seed).toBe(seed);
    expect(decoded.tape.seed).toBe(seed);
    expect(decoded.tape.acceptedCheckpoint.scientificState?.seed).toBe(seed);
    digests.add(decoded.tape.acceptedCheckpoint.digest);
  }
  expect(digests.size).toBe(3);
  passed("full-u64-seed-scientific-replay");
});

test("a change to an unplotted latent coordinate changes the complete recording checksum", async () => {
  const parameters = checkpoint(0).initialConditions as Bm01Parameters;
  const recorded = await createBm01Recording(parameters, {}, fixture.recorder);
  assert.ok(recorded.kind === "accepted");
  const before = await createBm01RecordingCheckpoint(
    recorded.data,
    BM01_FRANKENSIM_RECORDER_OWNER,
    fixture.sourceDigest,
  );
  const values = recorded.data.values.slice();
  // Tracer 99, z axis, an interior grid point: neither an observed endpoint nor a plotted trace.
  const index = 299 * 3001 + 1234;
  values[index] = (values[index] ?? 0) + 1e-12;
  const after = await createBm01RecordingCheckpoint(
    { ...recorded.data, values },
    BM01_FRANKENSIM_RECORDER_OWNER,
    fixture.sourceDigest,
  );
  expect(after.digest).not.toBe(before.digest);
  expect(after.seed).toBe(before.seed);
  expect(after.draws).toBe(before.draws);
  passed("full-latent-grid-not-configuration-only");
});
