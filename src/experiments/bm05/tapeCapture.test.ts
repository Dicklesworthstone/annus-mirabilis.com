import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  HOST_WALK_DRAW_OWNER,
  HOST_WALK_NORMALS,
} from "../../physics/reference/diffusion/walks.ts";
import { HOST_NORMAL_VERSION } from "../../physics/reference/philox.ts";
import { bm05Laboratory, bm05ReplayFixture } from "../../testing/bm05ReplayHarness.ts";
import { LabProtocolError } from "../../workers/protocol/bm06.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import {
  captureRecordedStop,
  type RecordedExperiment,
  type RecordingResult,
  readRecordedExperiment,
  recordedExperimentWalkthrough,
  writeRecordedExperiment,
} from "../permalink/recordedExperiments.ts";
import { validateTapeV2 } from "../permalink/schema.ts";
import { applyWalkthroughCheckpointAsync } from "../permalink/walkthroughActions.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { FRANKENSIM_NORMAL_VERSION, PINNED_ARTIFACT } from "../provenance/pinnedFrankenSim.ts";
import { BM05_DEFAULTS, BM05_FRANKENSIM_DRAW_OWNER, type Bm05Parameters } from "./definition.ts";
import type { Bm05RecordingCheckpoint } from "./recordingCheckpoint.ts";
import { createBm05Session } from "./session.ts";
import { createBm05WalkthroughTarget } from "./tape.ts";
import {
  bm05CheckpointDigest,
  bm05ScientificState,
  verifyBm05ScientificCheckpoint,
} from "./tapeCheckpoint.ts";

const fixture = await bm05ReplayFixture();
const sessions: WorkerTapeSession[] = [];
function laboratory(options: Parameters<typeof bm05Laboratory>[1] = {}) {
  const lab = bm05Laboratory(fixture, options);
  sessions.push(lab.session);
  return lab;
}
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});
const parameters: Bm05Parameters = {
  ...BM05_DEFAULTS,
  kernel: "gaussian",
  seed: "18446744073709551615",
  walkers: 8,
  runSteps: 8,
  n: 4,
};

function acceptedValue<T>(outcome: RecordingResult<T>): T {
  assert.ok(outcome.kind === "accepted", JSON.stringify(outcome));
  return outcome.value;
}
async function capture(lab: ReturnType<typeof laboratory>, settings = parameters) {
  expect((await applyWorkerSettings(lab.session, settings)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  const result = await lab.binding.capture(lab.session, accepted);
  assert.ok(result.kind === "captured", JSON.stringify(result));
  return result.tape;
}

test("(session.ts:47) malformed-response rejects invalid prepared walk settings and accepts the owner-produced example", () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  expect(before.status).toBe("accepted");
  expect(before.accepted?.parameters).toEqual(fixture.example.parameters);
  assert.throws(
    () =>
      createBm05Session(
        "invalid-prepared-walk",
        {
          ...fixture.example,
          parameters: { ...fixture.example.parameters, walkers: 0 },
        },
        lab.factory,
      ),
    (error: unknown) =>
      error instanceof LabProtocolError &&
      error.code === "malformed-response" &&
      error.message === "Invalid prepared walk settings.",
  );
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot()).toBe(before);
});

test("the displayed walk example cannot be saved as a calculated scientific trial", async () => {
  const lab = laboratory();
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  const result = await lab.binding.capture(lab.session, accepted);
  expect(result.kind).toBe("unavailable");
  if (result.kind === "unavailable") expect(result.notice).toContain("Calculate this walk trial");
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
});

test("coin, uniform and both Gaussian engines capture complete scientific checkpoints and share exact trials", async () => {
  for (const trial of [
    { kernel: "coin", host: true },
    { kernel: "uniform", host: true },
    { kernel: "gaussian", host: true },
    { kernel: "gaussian", host: false },
  ] as const) {
    const options = trial.host ? { normals: () => HOST_WALK_NORMALS } : {};
    const lab = laboratory(options);
    const settings = { ...parameters, kernel: trial.kernel };
    const tape = await capture(lab, settings);
    const publication = lab.session.acceptedPublication?.();
    assert.ok(publication);
    expect(publication.recordingCheckpoint).toMatchObject({
      ownerId: trial.host ? HOST_WALK_DRAW_OWNER : BM05_FRANKENSIM_DRAW_OWNER,
      normalVersion: trial.host ? HOST_NORMAL_VERSION : FRANKENSIM_NORMAL_VERSION,
      artifactDigest: trial.host ? fixture.sourceDigest : `sha256:${PINNED_ARTIFACT.wasmDigest}`,
      seed: settings.seed,
    });
    expect(tape.events).toEqual([]);
    expect(tape.initialConditions).toEqual(settings);
    expect(tape.acceptedCheckpoint).toMatchObject({
      acceptedActionIndex: 0,
      acceptedInputRevision: 0,
      scientificState: bm05ScientificState(settings),
    });
    expect(
      await verifyBm05ScientificCheckpoint(tape, publication, fixture.sourceDigest),
    ).toBeNull();
    const encoded = encodeTapePermalink(tape);
    expect(`/lab/bm-05/?tape=${encoded}`.length).toBeLessThanOrEqual(2048);
    const decoded = decodeTapePermalink(encoded);
    assert.ok(decoded.kind === "success");
    const receiving = laboratory(options);
    expect((await restoreWorkerTape(receiving.binding, receiving.session, decoded.tape)).kind).toBe(
      "restored",
    );
    expect(receiving.session.acceptedParameters()).toEqual(settings);
    const replayed = receiving.session.acceptedPublication?.();
    assert.ok(replayed);
    expect(await verifyBm05ScientificCheckpoint(tape, replayed, fixture.sourceDigest)).toBeNull();
    expect(replayed.recordingCheckpoint).toEqual(publication.recordingCheckpoint);
  }
});

test("saved host Gaussian observations survive JSON export and import and replay backwards through the real owner", async () => {
  const lab = laboratory({ normals: () => HOST_WALK_NORMALS });
  let recording: RecordedExperiment | null = null;
  for (const n of [2, 6]) {
    const tape = await capture(lab, { ...parameters, n });
    recording = acceptedValue(
      captureRecordedStop(
        recording,
        tape,
        "One Gaussian trial",
        `Step ${n}`,
        "Compare recorded observations.",
        validateTapeV2,
      ),
    );
  }
  assert.ok(recording);
  const file = acceptedValue(writeRecordedExperiment(recording, validateTapeV2));
  const imported = acceptedValue(readRecordedExperiment(file, "bm-05", validateTapeV2));
  expect(imported.stops.map((stop) => stop.tape.seed)).toEqual([parameters.seed, parameters.seed]);
  const receiving = laboratory({ normals: () => HOST_WALK_NORMALS });
  const previous = receiving.session.getSnapshot();
  const walkthrough = recordedExperimentWalkthrough(imported);
  const target = createBm05WalkthroughTarget(receiving.binding, receiving.session, () => {});
  expect(receiving.session.getSnapshot()).toBe(previous);
  expect(receiving.channels).toHaveLength(0);
  for (const index of [1, 0]) {
    expect((await applyWalkthroughCheckpointAsync(target, walkthrough, index)).kind).toBe(
      "replayed",
    );
    expect(receiving.session.acceptedParameters()).toMatchObject({ n: index === 1 ? 6 : 2 });
  }
});

test("host and pinned Gaussian checkpoints refuse cross-engine replay and preserve the accepted result", async () => {
  for (const hostFirst of [true, false]) {
    const source = laboratory(hostFirst ? { normals: () => HOST_WALK_NORMALS } : {});
    const tape = await capture(source);
    const receiving = laboratory(hostFirst ? {} : { normals: () => HOST_WALK_NORMALS });
    const previous = receiving.session.getSnapshot();
    const outcome = await restoreWorkerTape(receiving.binding, receiving.session, tape);
    expect(outcome.kind).toBe("not-restored");
    if (outcome.kind === "not-restored")
      expect(outcome.notice).toContain("different calculation engine");
    expect(receiving.session.getSnapshot()).toBe(previous);
    expect(receiving.channels).toHaveLength(1);
    expect(receiving.channels[0]?.disposed).toBe(true);
  }
});

test("walk capture copies accepted owner evidence and cannot save a stale or foreign result", async () => {
  const lab = laboratory({ normals: () => HOST_WALK_NORMALS });
  await capture(lab);
  const accepted = lab.session.getSnapshot().accepted;
  const publication = lab.session.acceptedPublication?.();
  assert.ok(accepted && publication && lab.binding.capture);
  const original = structuredClone(publication);
  (publication.parameters as Record<string, unknown>).seed = "0";
  (publication.recordingCheckpoint as { digest: string }).digest = `host:sha256:${"0".repeat(64)}`;
  const positions = publication.outputs.find((output) => output.quantityId === "walkPositions");
  assert.ok(positions?.status === "value" && positions.value instanceof Float64Array);
  positions.value.fill(123);
  expect(lab.session.acceptedPublication?.()).toEqual(original);
  const other = laboratory();
  assert.ok(other.binding.capture);
  expect((await other.binding.capture(other.session, accepted)).kind).toBe("unavailable");
  const saving = lab.binding.capture(lab.session, accepted);
  lab.session.setSchedulingPaused(true);
  lab.session.apply(parameters);
  const stale = await saving;
  expect(stale.kind).toBe("unavailable");
  if (stale.kind === "unavailable") expect(stale.notice).toContain("changed while saving");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
});

test("a saved host Gaussian trial remains cancellable before an isolated replay can publish", async () => {
  const source = laboratory({ normals: () => HOST_WALK_NORMALS });
  const tape = await capture(source);
  const receiving = laboratory({ normals: () => HOST_WALK_NORMALS, hold: () => true });
  const previous = receiving.session.getSnapshot();
  const controller = new AbortController();
  const pending = restoreWorkerTape(receiving.binding, receiving.session, tape, {
    signal: controller.signal,
  });
  const owner = await receiving.channel(0);
  await owner.result;
  controller.abort();
  expect((await pending).kind).toBe("not-restored");
  expect(owner.disposed).toBe(true);
  owner.release();
  await Promise.resolve();
  expect(receiving.session.getSnapshot()).toBe(previous);
});

test("a Gaussian host receipt cannot claim a pinned transform or mixed output owners", async () => {
  const lab = laboratory({ normals: () => HOST_WALK_NORMALS });
  await capture(lab);
  const publication = lab.session.acceptedPublication?.();
  assert.ok(publication);
  const receipt = publication.recordingCheckpoint as Bm05RecordingCheckpoint;
  for (const patch of [
    { normalVersion: FRANKENSIM_NORMAL_VERSION },
    { artifactDigest: `sha256:${PINNED_ARTIFACT.wasmDigest}` },
    { ownerId: BM05_FRANKENSIM_DRAW_OWNER },
  ]) {
    expect(
      (
        await bm05CheckpointDigest(
          {
            ...publication,
            recordingCheckpoint: { ...receipt, ...patch },
          },
          fixture.sourceDigest,
          0,
        )
      ).kind,
    ).toBe("not-restored");
  }
  expect(
    (
      await bm05CheckpointDigest(
        {
          ...publication,
          outputs: publication.outputs.map((output) =>
            output.quantityId === "walkPositions"
              ? { ...output, ownerId: BM05_FRANKENSIM_DRAW_OWNER }
              : output,
          ),
        },
        fixture.sourceDigest,
        0,
      )
    ).kind,
  ).toBe("not-restored");
});
