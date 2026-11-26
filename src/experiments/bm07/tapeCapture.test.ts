import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { INFERENCE_GRID_DT, INFERENCE_GRID_STEPS } from "../../physics/reference/inference/synthetic.ts";
import { bm07Laboratory, bm07ReplayFixture } from "../../testing/bm07ReplayHarness.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { BM07_DEFAULTS } from "./definition.ts";
import { bm07ScientificState, verifyBm07ScientificCheckpoint } from "./tapeCheckpoint.ts";

const fixture = await bm07ReplayFixture();
const sessions: WorkerTapeSession[] = [];
function laboratory(options: Parameters<typeof bm07Laboratory>[1] = {}) {
  const lab = bm07Laboratory(fixture, options);
  sessions.push(lab.session);
  return lab;
}
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

test("the displayed inference example has no personal scientific recording", async () => {
  const lab = laboratory();
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  const result = await lab.binding.capture(lab.session, accepted);
  expect(result.kind).toBe("unavailable");
  if (result.kind === "unavailable") expect(result.notice).toContain("Calculate this inference trial");
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
});

test("an ordinary inference run captures its full trial and explicitly verifies it on replay", async () => {
  const lab = laboratory();
  const parameters = {
    ...BM07_DEFAULTS,
    seed: "18446744073709551615",
    radiusKnown: true,
    estimator: "drift-centered" as const,
  };
  expect((await applyWorkerSettings(lab.session, parameters)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  const publication = lab.session.acceptedPublication?.();
  assert.ok(accepted && publication && lab.binding.capture);
  expect(Object.hasOwn(accepted, "recordingCheckpoint")).toBe(false);
  const captured = await lab.binding.capture(lab.session, accepted);
  assert.ok(captured.kind === "captured", JSON.stringify(captured));
  const tape = captured.tape;
  expect(tape.events).toEqual([]);
  expect(tape.initialConditions).toEqual({ ...parameters, radiusKnown: "true" });
  expect(tape.seed).toBe(parameters.seed);
  expect(tape.replayGrid).toEqual({
    baseSpacing: INFERENCE_GRID_DT,
    horizon: INFERENCE_GRID_DT * INFERENCE_GRID_STEPS,
  });
  expect(tape.acceptedCheckpoint).toMatchObject({
    acceptedActionIndex: 0,
    acceptedInputRevision: 0,
    scientificState: bm07ScientificState(parameters),
  });
  expect(tape.acceptedCheckpoint.digest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
  expect(await verifyBm07ScientificCheckpoint(tape, publication, fixture.sourceDigest)).toBeNull();
  const encoded = encodeTapePermalink(tape);
  const decoded = decodeTapePermalink(encoded);
  assert.ok(decoded.kind === "success");
  const receiver = laboratory();
  const before = receiver.session.getSnapshot().accepted;
  expect(receiver.channels).toHaveLength(0);
  expect(
    (await restoreWorkerTape(receiver.binding, receiver.session, {
      ...decoded.tape,
      acceptedCheckpoint: {
        ...decoded.tape.acceptedCheckpoint,
        digest: "host:sha256:" + "0".repeat(64),
      },
    })).kind,
  ).toBe("not-restored");
  expect(receiver.session.getSnapshot().accepted).toBe(before);
  expect((await restoreWorkerTape(receiver.binding, receiver.session, decoded.tape)).kind).toBe("restored");
  expect(receiver.session.acceptedParameters()).toEqual(parameters);
  expect(receiver.session.acceptedPublication?.()?.recordingCheckpoint).toEqual(publication.recordingCheckpoint);
});

test("the inference receipt exposes copies and follows accepted estimator changes", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, BM07_DEFAULTS)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  const publication = lab.session.acceptedPublication?.();
  assert.ok(accepted && publication && lab.binding.capture);
  const original = structuredClone(publication);
  const first = await lab.binding.capture(lab.session, accepted);
  assert.ok(first.kind === "captured");
  (publication.parameters as Record<string, unknown>).seed = "0";
  (publication.revisions as { input: number }).input += 1;
  (publication.recordingCheckpoint as { digest: string }).digest = "host:sha256:" + "0".repeat(64);
  const positions = publication.outputs.find((output) => output.quantityId === "observationPositions");
  assert.ok(positions?.status === "value" && positions.value instanceof Float64Array);
  positions.value.fill(123);
  expect(lab.session.acceptedPublication?.()).toEqual(original);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect((await applyWorkerSettings(lab.session, { ...BM07_DEFAULTS, radiusKnown: true })).kind).toBe("restored");
  const next = lab.session.getSnapshot().accepted;
  assert.ok(next);
  const second = await lab.binding.capture(lab.session, next);
  assert.ok(second.kind === "captured");
  expect(second.tape.initialConditions.radiusKnown).toBe("true");
  expect(second.tape.acceptedCheckpoint.digest).not.toBe(first.tape.acceptedCheckpoint.digest);
  expect(lab.session.acceptedPublication?.()?.recordingCheckpoint).toEqual(original.recordingCheckpoint);
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
});

test("a later result cannot borrow the earlier inference recording receipt", async () => {
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
  expect((await applyWorkerSettings(lab.session, BM07_DEFAULTS)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(lab.session.acceptedPublication?.()).not.toBeNull();
  omitReceipt = true;
  expect((await applyWorkerSettings(lab.session, { ...BM07_DEFAULTS, M: 60 })).kind).toBe("not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
});

test("incomplete observations are refused before replacing the accepted inference trial", async () => {
  let damagedPublications = 0;
  const lab = laboratory({
    transform(message) {
      if (message.result.kind === "accepted") {
        damagedPublications++;
        return {
          ...message,
          result: {
            kind: "accepted",
            data: {
              ...message.result.data,
              outputs: message.result.data.outputs.filter((output) => output.quantityId !== "observationPositions"),
            },
          },
        };
      }
      return message;
    },
  });
  const previous = lab.session.getSnapshot().accepted;
  assert.ok(previous && lab.binding.capture);
  expect(previous.outputs.some((output) => output.quantityId === "observationPositions")).toBe(true);
  expect((await applyWorkerSettings(lab.session, BM07_DEFAULTS)).kind).toBe("not-restored");
  expect(damagedPublications).toBe(1);
  expect(lab.session.getSnapshot().accepted).toBe(previous);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, previous)).kind).toBe("unavailable");
});

test("hypothetical coverage trials are not captured as a single synthetic trial", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, { ...BM07_DEFAULTS, coverageTrials: 1 })).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  const capture = await lab.binding.capture(lab.session, accepted);
  expect(capture.kind).toBe("unavailable");
  if (capture.kind === "unavailable") expect(capture.notice).toContain("one synthetic trial");
});

test("pending and non-synthetic worker requests cannot capture the retained previous trial", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, BM07_DEFAULTS)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  lab.session.setSchedulingPaused(true);
  lab.session.apply({ ...BM07_DEFAULTS, M: 60 });
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
  const refused = laboratory();
  expect((await applyWorkerSettings(refused.session, BM07_DEFAULTS)).kind).toBe("restored");
  const previous = refused.session.getSnapshot().accepted;
  assert.ok(previous && refused.binding.capture);
  expect(
    (await applyWorkerSettings(refused.session, { ...BM07_DEFAULTS, observationSet: "kitchen" })).kind,
  ).toBe("not-restored");
  expect(refused.session.getSnapshot().accepted).toBe(previous);
  expect(refused.session.acceptedPublication?.()).toBeNull();
  expect((await refused.binding.capture(refused.session, previous)).kind).toBe("unavailable");
});

test("capture requires the exact session and rechecks identity after asynchronous hashing", async () => {
  const lab = laboratory();
  expect((await applyWorkerSettings(lab.session, BM07_DEFAULTS)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  const other = laboratory();
  assert.ok(accepted && lab.binding.capture && other.binding.capture);
  expect((await other.binding.capture(other.session, accepted)).kind).toBe("unavailable");
  expect(other.channels).toHaveLength(0);
  const pendingCapture = lab.binding.capture(lab.session, accepted);
  lab.session.apply(BM07_DEFAULTS);
  const result = await pendingCapture;
  expect(result.kind).toBe("unavailable");
  if (result.kind === "unavailable") expect(result.notice).toContain("changed while saving");
});

test("a receipt for another seed cannot attest to the accepted inference outputs", async () => {
  const lab = laboratory({
    transform(message) {
      if (message.result.kind === "accepted" && message.result.data.recordingCheckpoint)
        return {
          ...message,
          result: {
            kind: "accepted",
            data: {
              ...message.result.data,
              recordingCheckpoint: { ...message.result.data.recordingCheckpoint, seed: "0" },
            },
          },
        };
      return message;
    },
  });
  const previous = lab.session.getSnapshot().accepted;
  expect((await applyWorkerSettings(lab.session, BM07_DEFAULTS)).kind).toBe("not-restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  expect(accepted).toBe(previous);
  expect(lab.session.acceptedPublication?.()).toBeNull();
  expect((await lab.binding.capture(lab.session, accepted)).kind).toBe("unavailable");
});
