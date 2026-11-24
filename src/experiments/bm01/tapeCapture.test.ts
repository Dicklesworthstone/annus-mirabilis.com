import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { HOST_NORMAL_VERSION } from "../../physics/reference/philox.ts";
import { bm01Laboratory, bm01ReplayFixture } from "../../testing/bm01ReplayHarness.ts";
import { HOST_TRACER_RECORDER } from "../../workers/operations/bm01.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { BM01_DEFAULTS, BM01_HOST_RECORDER_OWNER } from "./definition.ts";
import type { Bm01RecordingCheckpoint } from "./recordingCheckpoint.ts";
import {
  bm01CheckpointDigest,
  bm01ScientificState,
  verifyBm01ScientificCheckpoint,
} from "./tapeCheckpoint.ts";

const fixture = await bm01ReplayFixture();
const sessions: WorkerTapeSession[] = [];
function laboratory(options: Parameters<typeof bm01Laboratory>[1] = {}) {
  const lab = bm01Laboratory(fixture, options);
  sessions.push(lab.session);
  return lab;
}
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

const parameters = {
  ...BM01_DEFAULTS,
  seed: "18446744073709551615",
  M: 4,
  H: 1,
  interval: 0.2,
};

test("a host Brownian trial captures its exact engine and complete streams, shares and replays", async () => {
  const lab = laboratory({ recorder: () => HOST_TRACER_RECORDER });
  expect((await applyWorkerSettings(lab.session, parameters)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  const publication = lab.session.acceptedPublication?.();
  assert.ok(accepted && publication && lab.binding.capture);
  expect(publication.recordingCheckpoint).toMatchObject({
    ownerId: BM01_HOST_RECORDER_OWNER,
    normalVersion: HOST_NORMAL_VERSION,
    artifactDigest: fixture.sourceDigest,
    seed: parameters.seed,
  });
  const captured = await lab.binding.capture(lab.session, accepted);
  assert.ok(captured.kind === "captured", JSON.stringify(captured));
  expect(captured.tape.events).toEqual([]);
  expect(captured.tape.initialConditions).toEqual(parameters);
  expect(captured.tape.acceptedCheckpoint).toMatchObject({
    acceptedActionIndex: 0,
    acceptedInputRevision: 0,
    scientificState: bm01ScientificState(parameters),
  });
  expect(
    await verifyBm01ScientificCheckpoint(captured.tape, publication, fixture.sourceDigest),
  ).toBeNull();
  const encoded = encodeTapePermalink(captured.tape);
  expect(`/lab/bm-01/?tape=${encoded}`.length).toBeLessThanOrEqual(2048);
  const decoded = decodeTapePermalink(encoded);
  assert.ok(decoded.kind === "success");
  const receiving = laboratory({ recorder: () => HOST_TRACER_RECORDER });
  expect((await restoreWorkerTape(receiving.binding, receiving.session, decoded.tape)).kind).toBe(
    "restored",
  );
  expect(receiving.session.acceptedParameters()).toEqual(parameters);
  const replayed = receiving.session.acceptedPublication?.();
  assert.ok(replayed);
  expect(
    await verifyBm01ScientificCheckpoint(captured.tape, replayed, fixture.sourceDigest),
  ).toBeNull();
  expect(replayed.recordingCheckpoint).toEqual(publication.recordingCheckpoint);
});

test("host and pinned Brownian checkpoints refuse each other's engine without changing accepted state", async () => {
  for (const hostFirst of [true, false]) {
    const source = laboratory(hostFirst ? { recorder: () => HOST_TRACER_RECORDER } : {});
    expect((await applyWorkerSettings(source.session, parameters)).kind).toBe("restored");
    const accepted = source.session.getSnapshot().accepted;
    assert.ok(accepted && source.binding.capture);
    const captured = await source.binding.capture(source.session, accepted);
    assert.ok(captured.kind === "captured", JSON.stringify(captured));
    const receiving = laboratory(hostFirst ? {} : { recorder: () => HOST_TRACER_RECORDER });
    const previous = receiving.session.getSnapshot();
    const result = await restoreWorkerTape(receiving.binding, receiving.session, captured.tape);
    expect(result.kind).toBe("not-restored");
    if (result.kind === "not-restored")
      expect(result.notice).toContain("different normal transform");
    expect(receiving.session.getSnapshot()).toBe(previous);
    expect(receiving.channels).toHaveLength(1);
    expect(receiving.channels[0]?.disposed).toBe(true);
  }
});

test("host Brownian capture rejects relabeled engine, source, setup and stream receipts", async () => {
  const lab = laboratory({ recorder: () => HOST_TRACER_RECORDER });
  expect((await applyWorkerSettings(lab.session, parameters)).kind).toBe("restored");
  const publication = lab.session.acceptedPublication?.();
  assert.ok(publication);
  const receipt = publication.recordingCheckpoint as Bm01RecordingCheckpoint;
  const patches: Partial<Bm01RecordingCheckpoint>[] = [
    { ownerId: "another-brownian-owner" },
    { normalVersion: "another-normal-transform" },
    { artifactDigest: `sha256:${"0".repeat(64)}` },
    { sourceDigest: `source:sha256:${"0".repeat(64)}` },
    { allocationId: "another-stream" },
    { seed: "0" },
    { tracers: receipt.tracers + 1 },
    { steps: receipt.steps + 1 },
    { baseSpacing: receipt.baseSpacing * 2 },
    { diffusionCoefficient: receipt.diffusionCoefficient * 2 },
    { draws: receipt.draws + 1 },
  ];
  for (const patch of patches) {
    const digest = await bm01CheckpointDigest(
      { ...publication, recordingCheckpoint: { ...receipt, ...patch } },
      fixture.sourceDigest,
      0,
    );
    expect(digest.kind).toBe("not-restored");
  }
  expect(
    (
      await bm01CheckpointDigest(
        {
          ...publication,
          outputs: publication.outputs.map((output) =>
            output.quantityId === "tracerPositions"
              ? { ...output, ownerId: "another-brownian-owner" }
              : output,
          ),
        },
        fixture.sourceDigest,
        0,
      )
    ).kind,
  ).toBe("not-restored");
});
