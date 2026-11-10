import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  bm08Laboratory,
  bm08ReplayFixture,
  recordBm08Checkpoints,
} from "../../testing/bm08ReplayHarness.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { draftTapeForSettings, loadDraftTape } from "../permalink/draftTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { BM08_DRAFT_TAPE } from "./draftTape.ts";
import { bm08CheckpointDigest } from "./tapeCheckpoint.ts";

const fixture = await bm08ReplayFixture();
const stops = await recordBm08Checkpoints(fixture);
const last = stops.at(-1);
assert.ok(last);
const tape = last.tape;
const sessions: WorkerTapeSession[] = [];
function laboratory(options: Parameters<typeof bm08Laboratory>[1] = {}) {
  const lab = bm08Laboratory(fixture, options);
  sessions.push(lab.session);
  return lab;
}
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

test("ordinary camera links carry the physical seed and grid and still load without calculating", () => {
  const lab = laboratory();
  const shared = draftTapeForSettings(BM08_DRAFT_TAPE, fixture.example.parameters);
  assert.ok(shared);
  expect(shared.seed).toBe(fixture.example.parameters.seed);
  expect(loadDraftTape(lab.binding, shared).kind).toBe("loaded");
  expect(lab.channels).toHaveLength(0);
});

test("camera checkpoints replay warm and cold observations while retaining one complete physical path", async () => {
  const lab = laboratory();
  expect(lab.channels).toHaveLength(0);
  const recordingDigests = stops.map(
    (stop) => (stop.publication.recordingCheckpoint as { digest: string }).digest,
  );
  expect(new Set(recordingDigests).size).toBe(1);
  const runIds: string[] = [];
  for (const index of [0, 1, 2, 0]) {
    const stop = stops[index];
    assert.ok(stop);
    expect((await restoreWorkerTape(lab.binding, lab.session, stop.tape)).kind).toBe("restored");
    const accepted = lab.session.getSnapshot().accepted;
    assert.ok(accepted);
    runIds.push(accepted.runId);
    expect(accepted.parameters.exposure).toBe(index === 0 ? 0 : 0.5);
    expect(accepted.parameters.sigma).toBe(index === 2 ? 0.2e-6 : 0);
    expect(Object.hasOwn(accepted, "recordingCheckpoint")).toBe(false);
  }
  expect(new Set(runIds).size).toBe(1);
}, 20000);

test("camera replay preserves three independent full-width seeds and bounded shared links", async () => {
  const parameters = {
    ...fixture.example.parameters,
    seed: "18446744073709551615",
    noiseSeed: "9007199254740993",
    clickSeed: "9007199254740995",
  };
  const recorded = (await recordBm08Checkpoints(fixture, parameters)).at(-1);
  assert.ok(recorded);
  const encoded = encodeTapePermalink(recorded.tape);
  expect(`/lab/bm-08/?tape=${encoded}`.length).toBeLessThanOrEqual(2048);
  const decoded = decodeTapePermalink(encoded);
  expect(decoded.kind).toBe("success");
  if (decoded.kind !== "success") return;
  const lab = laboratory();
  expect((await restoreWorkerTape(lab.binding, lab.session, decoded.tape)).kind).toBe("restored");
  expect(lab.session.acceptedParameters()).toMatchObject({
    seed: parameters.seed,
    noiseSeed: parameters.noiseSeed,
    clickSeed: parameters.clickSeed,
  });
}, 20000);

test("wrong camera source, settings, grid and stream positions refuse before a worker starts", async () => {
  const lab = laboratory();
  const accepted = lab.session.getSnapshot().accepted;
  const state = tape.acceptedCheckpoint.scientificState;
  assert.ok(state);
  const variants: TapeV2[] = [
    {
      ...tape,
      modelIdentity: { ...tape.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
    },
    { ...tape, initialConditions: { ...tape.initialConditions, coverageTrials: 10 } },
    { ...tape, replayGrid: { baseSpacing: 0.5, horizon: 1028 } },
    { ...tape, events: tape.events.map((event) => ({ ...event, commandClass: "setup-change" })) },
    {
      ...tape,
      acceptedCheckpoint: {
        ...tape.acceptedCheckpoint,
        scientificState: { ...state, streamPositions: state.streamPositions.slice(1) },
      },
    },
  ];
  for (const invalid of variants)
    expect((await restoreWorkerTape(lab.binding, lab.session, invalid)).kind).toBe("not-restored");
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
});

test("a changed complete latent checksum refuses isolated replay and preserves the accepted result", async () => {
  const lab = laboratory({
    transform(message) {
      if (message.result.kind === "accepted" && message.result.data.recordingCheckpoint)
        return {
          ...message,
          result: {
            ...message.result,
            data: {
              ...message.result.data,
              recordingCheckpoint: {
                ...message.result.data.recordingCheckpoint,
                digest: `host:sha256:${"0".repeat(64)}`,
              },
            },
          },
        };
      return message;
    },
  });
  const accepted = lab.session.getSnapshot().accepted;
  expect((await restoreWorkerTape(lab.binding, lab.session, tape)).kind).toBe("not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.channels).toHaveLength(1);
  expect(lab.channels[0]?.disposed).toBe(true);
}, 20000);

test("the live publication is checked again after a successful isolated replay", async () => {
  const lab = laboratory({
    transform(message, channel) {
      if (channel === 1 && message.result.kind === "accepted") {
        const output = message.result.data.outputs.find(
          (entry) => entry.quantityId === "positions",
        );
        assert.ok(output?.status === "value" && output.value instanceof Float64Array);
        output.value[0] = (output.value[0] ?? 0) + 1e-6;
      }
      return message;
    },
  });
  const accepted = lab.session.getSnapshot().accepted;
  expect((await restoreWorkerTape(lab.binding, lab.session, tape)).kind).toBe("not-restored");
  expect(lab.channels).toHaveLength(2);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
}, 20000);

test("cancelling a hidden camera replay starts no worker and keeps the last accepted result", async () => {
  const lab = laboratory();
  const accepted = lab.session.getSnapshot().accepted;
  lab.session.setSchedulingPaused(true);
  const abort = new AbortController();
  const pending = restoreWorkerTape(lab.binding, lab.session, tape, { signal: abort.signal });
  await Promise.resolve();
  expect(lab.channels).toHaveLength(0);
  abort.abort();
  expect((await pending).kind).toBe("not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
});

test("a newer reader calculation supersedes held replay without being overwritten", async () => {
  const lab = laboratory({ hold: (channel) => channel === 0 });
  const pending = restoreWorkerTape(lab.binding, lab.session, tape);
  const trial = await lab.channel(0);
  await trial.result;
  expect(
    (await applyWorkerSettings(lab.session, { ...fixture.example.parameters, M: 12 })).kind,
  ).toBe("restored");
  const newer = lab.session.getSnapshot().accepted;
  trial.release();
  expect((await pending).kind).toBe("not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(newer);
  expect(lab.session.getSnapshot().accepted?.parameters.M).toBe(12);
}, 20000);

test("a current-model calculation creates a new run and cache diagnostics cannot change a checkpoint", async () => {
  const lab = laboratory();
  expect((await restoreWorkerTape(lab.binding, lab.session, tape)).kind).toBe("restored");
  const prior = lab.session.getSnapshot().accepted;
  expect(
    (await applyWorkerSettings(lab.session, lab.session.acceptedParameters(), { newRun: true }))
      .kind,
  ).toBe("restored");
  expect(lab.session.getSnapshot().accepted?.runId).not.toBe(prior?.runId);
  const changed = {
    ...last.publication,
    outputs: last.publication.outputs.map((output) =>
      output.status === "value" && output.quantityId === "requestDraws"
        ? { ...output, value: 999999 }
        : output,
    ),
  };
  expect(await bm08CheckpointDigest(changed, fixture.sourceDigest, 2)).toEqual({
    kind: "digest",
    digest: tape.acceptedCheckpoint.digest,
  });
}, 20000);
