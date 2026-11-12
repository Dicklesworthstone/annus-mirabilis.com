import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { CAMERA_GRID_DT, CAMERA_GRID_STEPS } from "../../physics/reference/inference/camera.ts";
import { bm08Laboratory, bm08ReplayFixture } from "../../testing/bm08ReplayHarness.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { BM08_DEFAULTS } from "./definition.ts";
import { cameraObservationCsv } from "./export.ts";
import { bm08ScientificState, verifyBm08ScientificCheckpoint } from "./tapeCheckpoint.ts";

const fixture = await bm08ReplayFixture();
const sessions: WorkerTapeSession[] = [];
function laboratory(options: Parameters<typeof bm08Laboratory>[1] = {}) {
  const lab = bm08Laboratory(fixture, options);
  sessions.push(lab.session);
  return lab;
}
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

test("the displayed camera example cannot masquerade as a captured scientific recording", async () => {
  const lab = laboratory();
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  const result = await lab.binding.capture(lab.session, accepted);
  expect(result.kind).toBe("unavailable");
  if (result.kind === "unavailable") expect(result.notice).toContain("Calculate this camera trial");
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
});

test("a normal worker calculation captures a complete action-zero scientific tape and replays it", async () => {
  const lab = laboratory();
  const parameters = {
    ...fixture.example.parameters,
    seed: "18446744073709551615",
    noiseSeed: "9007199254740993",
    clickSeed: "9007199254740995",
    M: 12,
    flowDrift: 0.1e-6,
    stageDrift: -0.05e-6,
  };
  expect((await applyWorkerSettings(lab.session, parameters)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  const publication = lab.session.acceptedPublication?.();
  assert.ok(accepted && publication && lab.binding.capture);
  expect(accepted.actionIndex).toBeGreaterThan(0);
  expect(Object.hasOwn(accepted, "recordingCheckpoint")).toBe(false);
  const captured = await lab.binding.capture(lab.session, accepted);
  assert.ok(captured.kind === "captured", JSON.stringify(captured));
  const tape = captured.tape;
  expect(tape.events).toEqual([]);
  expect(tape.initialConditions).toEqual(parameters);
  expect(Object.keys(tape.initialConditions).sort()).toEqual(Object.keys(BM08_DEFAULTS).sort());
  expect(tape.seed).toBe(parameters.seed);
  expect(tape.modelIdentity.artifactDigest).toBe(fixture.sourceDigest.replace(/^source:/, "host:"));
  expect(tape.replayGrid).toEqual({
    baseSpacing: CAMERA_GRID_DT,
    horizon: CAMERA_GRID_DT * CAMERA_GRID_STEPS,
  });
  expect(tape.acceptedCheckpoint).toMatchObject({
    acceptedActionIndex: 0,
    acceptedInputRevision: 0,
    scientificState: bm08ScientificState(parameters),
  });
  expect(tape.acceptedCheckpoint.digest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
  expect(await verifyBm08ScientificCheckpoint(tape, publication, fixture.sourceDigest)).toBeNull();
  const encoded = encodeTapePermalink(tape);
  expect(`/lab/bm-08/?tape=${encoded}`.length).toBeLessThanOrEqual(2048);
  const decoded = decodeTapePermalink(encoded);
  assert.ok(decoded.kind === "success");
  const receiving = laboratory();
  expect(receiving.channels).toHaveLength(0);
  expect((await restoreWorkerTape(receiving.binding, receiving.session, decoded.tape)).kind).toBe(
    "restored",
  );
  expect(receiving.session.acceptedParameters()).toEqual(parameters);
});

test("exposing the recording receipt copies its settings, revisions, metadata and output buffers", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, fixture.example.parameters)).kind).toBe(
    "restored",
  );
  const accepted = lab.session.getSnapshot().accepted;
  const publication = lab.session.acceptedPublication?.();
  assert.ok(accepted && publication && lab.binding.capture);
  const original = structuredClone(publication);
  (publication.parameters as Record<string, unknown>).seed = "0";
  (publication.revisions as { input: number }).input += 1;
  (publication.recordingCheckpoint as { digest: string }).digest = `host:sha256:${"0".repeat(64)}`;
  const positions = publication.outputs.find((output) => output.quantityId === "positions");
  assert.ok(positions?.status === "value" && positions.value instanceof Float64Array);
  positions.value.fill(123);
  expect(lab.session.acceptedPublication?.()).toEqual(original);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  const captured = await lab.binding.capture(lab.session, accepted);
  assert.ok(captured.kind === "captured");
  expect(
    await verifyBm08ScientificCheckpoint(captured.tape, original, fixture.sourceDigest),
  ).toBeNull();
});

test("a later result without a recording receipt cannot reuse an earlier trial's receipt", async () => {
  let omitReceipt = false;
  const lab = laboratory({
    transform(message) {
      if (omitReceipt && message.result.kind === "accepted") {
        const data = { ...message.result.data };
        delete data.recordingCheckpoint;
        return { ...message, result: { kind: "accepted", data } };
      }
      return message;
    },
  });
  expect((await applyWorkerSettings(lab.session, fixture.example.parameters)).kind).toBe(
    "restored",
  );
  expect(lab.session.acceptedPublication?.()).not.toBeNull();
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  const csv = cameraObservationCsv(accepted, fixture.sourceDigest);
  omitReceipt = true;
  expect(
    (await applyWorkerSettings(lab.session, { ...fixture.example.parameters, M: 12 })).kind,
  ).toBe("not-restored");
  expect(lab.session.getSnapshot().status).toBe("unavailable");
  expect(lab.session.getSnapshot().outcome?.outcome).toBe("invariant-violation");
  expect(lab.session.getSnapshot().accepted === accepted).toBe(true);
  expect(cameraObservationCsv(accepted, fixture.sourceDigest)).toBe(csv);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
});

test("an incomplete worker response cannot become a captured scientific recording", async () => {
  const lab = laboratory({
    transform(message) {
      if (message.result.kind === "accepted")
        return {
          ...message,
          result: {
            kind: "accepted",
            data: {
              ...message.result.data,
              outputs: message.result.data.outputs.filter(
                (output) => output.quantityId !== "idealPositions",
              ),
            },
          },
        };
      return message;
    },
  });
  const previous = lab.session.getSnapshot().accepted;
  expect((await applyWorkerSettings(lab.session, fixture.example.parameters)).kind).toBe(
    "not-restored",
  );
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted?.final && lab.binding.capture);
  expect(accepted).toBe(previous);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
});

test("hypothetical coverage trials cannot be captured as one scientific trial", async () => {
  const lab = laboratory();
  expect(
    (await applyWorkerSettings(lab.session, { ...fixture.example.parameters, coverageTrials: 1 }))
      .kind,
  ).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  const result = await lab.binding.capture(lab.session, accepted);
  expect(result.kind).toBe("unavailable");
  if (result.kind === "unavailable") expect(result.notice).toContain("one trial");
});

test("pending and refused requests cannot expose or capture the previous accepted recording", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, fixture.example.parameters)).kind).toBe(
    "restored",
  );
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(lab.session.acceptedPublication?.()).not.toBeNull();
  lab.session.setSchedulingPaused(true);
  lab.session.apply({ M: 12 });
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
  expect(lab.session.apply({ M: 0 }).kind).toBe("refused");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
});

test("capture cannot borrow a final snapshot from another session", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, fixture.example.parameters)).kind).toBe(
    "restored",
  );
  const accepted = lab.session.getSnapshot().accepted;
  const receiving = laboratory();
  assert.ok(accepted && receiving.binding.capture);
  expect((await receiving.binding.capture(receiving.session, accepted)).kind).toBe("unavailable");
  expect(receiving.channels).toHaveLength(0);
});

test("capture rechecks exact accepted identity after asynchronous scientific hashing", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, fixture.example.parameters)).kind).toBe(
    "restored",
  );
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  const capture = lab.binding.capture(lab.session, accepted);
  // The same settings still create a newer request; matching their values is insufficient.
  lab.session.apply(fixture.example.parameters);
  const result = await capture;
  expect(result.kind).toBe("unavailable");
  if (result.kind === "unavailable") expect(result.notice).toContain("changed while saving");
});

test("a refusal during hashing cannot save the retained older accepted snapshot", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, fixture.example.parameters)).kind).toBe(
    "restored",
  );
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  const capture = lab.binding.capture(lab.session, accepted);
  expect(lab.session.apply({ M: 0 }).kind).toBe("refused");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect((await capture).kind).toBe("unavailable");
});
