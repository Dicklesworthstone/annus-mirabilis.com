import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  bm05Laboratory,
  bm05ReplayFixture,
  recordBm05Checkpoints,
} from "../../testing/bm05ReplayHarness.ts";
import { scientificDigest } from "../digest/scientificDigest.ts";
import { restoreWorkerTape } from "../permalink/workerSessionTape.ts";
import { BM05_DEFAULTS } from "./definition.ts";
import type { Bm05RecordingCheckpoint } from "./recordingCheckpoint.ts";
import { bm05CheckpointDigest, verifyBm05ScientificCheckpoint } from "./tapeCheckpoint.ts";

const fixture = await bm05ReplayFixture();
const stops = await recordBm05Checkpoints(
  fixture,
  { ...BM05_DEFAULTS, walkers: 24, runSteps: 8, n: 0 },
  [
    { actionIndex: 1, commandClass: "measurement-change", paramId: "n", value: 4 },
    { actionIndex: 2, commandClass: "measurement-change", paramId: "n", value: 8 },
  ],
);
const first = stops[0];
const second = stops[1];
assert.ok(first && second);
const receipt = first.publication.recordingCheckpoint as Bm05RecordingCheckpoint;
assert.ok(receipt);

async function rehash(patch: Partial<Bm05RecordingCheckpoint>) {
  const { digest: _digest, ...identity } = { ...receipt, ...patch };
  return { ...identity, digest: (await scientificDigest(identity)).digest };
}

test("portable walk checkpoints carry one complete recording across different observations", async () => {
  expect(receipt.coordinateCount).toBe(24 * 9);
  expect(receipt.trajectoryDigest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
  expect(second.publication.recordingCheckpoint).toEqual(receipt);
  expect(second.tape.acceptedCheckpoint.digest).not.toBe(first.tape.acceptedCheckpoint.digest);
  expect(
    await verifyBm05ScientificCheckpoint(first.tape, first.publication, fixture.sourceDigest),
  ).toBeNull();
  expect(
    await verifyBm05ScientificCheckpoint(second.tape, second.publication, fixture.sourceDigest),
  ).toBeNull();
});

test("identical displayed results cannot hide a different complete trajectory", async () => {
  // A corrupted full-path receipt must matter even when every transmitted plot and result is
  // byte-for-byte unchanged. Re-sign the metadata so this exercises the portable path binding.
  const changed = await rehash({ trajectoryDigest: `host:sha256:${"f".repeat(64)}` });
  const publication = { ...first.publication, recordingCheckpoint: changed };
  expect(publication.outputs).toBe(first.publication.outputs);
  const digest = await bm05CheckpointDigest(publication, fixture.sourceDigest, 1);
  expect(digest.kind).toBe("digest");
  if (digest.kind === "digest")
    expect(digest.digest).not.toBe(first.tape.acceptedCheckpoint.digest);
  expect(
    await verifyBm05ScientificCheckpoint(first.tape, publication, fixture.sourceDigest),
  ).toContain("complete walks");
});

test("a complete-path receipt cannot be relabelled as another setup or engine", async () => {
  const patches: Partial<Bm05RecordingCheckpoint>[] = [
    { sourceDigest: `source:sha256:${"0".repeat(64)}` },
    { artifactDigest: `source:sha256:${"0".repeat(64)}` },
    { normalVersion: "another-normal-transform" },
    { ownerId: "fs-wasm.philox_normals" },
    { seed: "9007199254740993" },
    { kernel: "uniform" },
    { walkers: receipt.walkers + 1 },
    { runSteps: receipt.runSteps + 1 },
    { stepRms: receipt.stepRms * 2 },
    { tau: receipt.tau * 2 },
    { streamKernelId: receipt.streamKernelId + 1 },
    { streamVersion: receipt.streamVersion + 1 },
    { coordinateCount: receipt.coordinateCount - 1 },
  ];
  for (const patch of patches) {
    const recordingCheckpoint = await rehash(patch);
    expect(
      (
        await bm05CheckpointDigest(
          { ...first.publication, recordingCheckpoint },
          fixture.sourceDigest,
          1,
        )
      ).kind,
    ).toBe("not-restored");
  }
});

test("missing and internally inconsistent complete-path receipts are refused", async () => {
  const { recordingCheckpoint: _receipt, ...publication } = first.publication;
  expect(await bm05CheckpointDigest(publication, fixture.sourceDigest, 1)).toMatchObject({
    kind: "not-restored",
    notice: "The walk worker did not supply a complete-trajectory checkpoint.",
  });
  expect(
    await bm05CheckpointDigest(
      {
        ...publication,
        recordingCheckpoint: { ...receipt, trajectoryDigest: `host:sha256:${"a".repeat(64)}` },
      },
      fixture.sourceDigest,
      1,
    ),
  ).toMatchObject({
    kind: "not-restored",
    notice: "The walk's complete-trajectory checkpoint is internally inconsistent.",
  });
});

test("runtime cache accounting does not change a portable scientific checkpoint", async () => {
  const diagnostics = new Set([
    "requestDraws",
    "replayedDraws",
    "reusedRecording",
    "retainedBytes",
  ]);
  const publication = {
    ...first.publication,
    outputs: first.publication.outputs.map((output) =>
      diagnostics.has(output.quantityId) &&
      output.status === "value" &&
      typeof output.value === "number"
        ? { ...output, value: output.value + 100 }
        : output,
    ),
  };
  expect(await bm05CheckpointDigest(publication, fixture.sourceDigest, 1)).toEqual({
    kind: "digest",
    digest: first.tape.acceptedCheckpoint.digest,
  });
});

test("a worker without a complete-path receipt cannot replace the accepted result on restore", async () => {
  const lab = bm05Laboratory(fixture, {
    transform(message) {
      if (message.result.kind !== "accepted") return message;
      const { recordingCheckpoint: _receipt, ...data } = message.result.data;
      return { ...message, result: { kind: "accepted", data } };
    },
  });
  try {
    const accepted = lab.session.getSnapshot().accepted;
    const outcome = await restoreWorkerTape(lab.binding, lab.session, first.tape);
    expect(outcome.kind).toBe("not-restored");
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    expect(lab.channels.length).toBeGreaterThan(0);
    expect(lab.channels.every((channel) => channel.disposed)).toBe(true);
  } finally {
    lab.session.disconnect();
  }
});
