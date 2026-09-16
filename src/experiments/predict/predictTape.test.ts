import assert from "node:assert/strict";
import test from "node:test";
import type { PredictionPromptSpec } from "../tapes/schema.ts";
import { MAX_SKETCH_POINTS, TapeValidationError } from "../tapes/schema.ts";
import {
  beginPrompt,
  keepToSelf,
  reveal,
  skipPrediction,
  submitPrediction,
} from "./predictState.ts";
import { buildPredictionTapeEvent, restorePromptFromTapeEvent } from "./predictTape.ts";

const SPEC: PredictionPromptSpec = {
  promptId: "bm-05-predict-step-shape",
  candidateIds: ["two-separate-piles", "same-bell-shape", "wider-bell"],
  verbalChoices: {
    directionIds: ["increase", "decrease", "unchanged"],
    shapeIds: ["linear", "square-root", "other"],
  },
  valueTargetIds: ["t0", "t1"],
  sketchAxisRanges: { x: [0, 10], y: [0, 1] },
};

test("serialization and restoration of the candidate form, using the tape module's own payload types", () => {
  const record = submitPrediction(beginPrompt(SPEC.promptId), {
    form: "candidate",
    candidateId: "same-bell-shape",
  });
  const event = buildPredictionTapeEvent(record, SPEC, "bm-05", 3);
  assert.ok(event);
  assert.equal(event.kind, "prediction");
  assert.equal(event.instrumentId, "bm-05");
  assert.equal(event.promptId, SPEC.promptId);
  assert.deepEqual(event.payload, { form: "candidate", candidateId: "same-bell-shape" });

  const restored = restorePromptFromTapeEvent(event);
  assert.equal(restored.state, "revealed");
  assert.deepEqual(restored.choice, { form: "candidate", candidateId: "same-bell-shape" });
});

test("serialization of the verbal and values forms", () => {
  const verbalRecord = submitPrediction(beginPrompt(SPEC.promptId), {
    form: "verbal",
    directionId: "increase",
    shapeId: "square-root",
  });
  const verbalEvent = buildPredictionTapeEvent(verbalRecord, SPEC, "bm-05", 1);
  assert.deepEqual(verbalEvent?.payload, {
    form: "verbal",
    directionId: "increase",
    shapeId: "square-root",
  });

  const valuesRecord = submitPrediction(beginPrompt(SPEC.promptId), {
    form: "values",
    targets: [{ targetId: "t0", value: 1.5 }],
  });
  const valuesEvent = buildPredictionTapeEvent(valuesRecord, SPEC, "bm-05", 1);
  assert.deepEqual(valuesEvent?.payload, {
    form: "values",
    targets: [{ targetId: "t0", value: 1.5 }],
  });
});

test("bounded sketch payloads are quantized to the tape's quantization and restore unchanged", () => {
  const points: readonly (readonly [number, number])[] = [
    [0, 0],
    [5, 0.5],
    [10, 1],
  ];
  const record = submitPrediction(beginPrompt(SPEC.promptId), { form: "sketch", points });
  const event = buildPredictionTapeEvent(record, SPEC, "bm-05", 1);
  assert.ok(event);
  assert.equal(event.payload.form, "sketch");
  const restored = restorePromptFromTapeEvent(event);
  assert.deepEqual(restored.choice, event.payload);
});

test("a sketch exceeding the point bound is rejected by the tape schema's own validator", () => {
  const points = Array.from({ length: MAX_SKETCH_POINTS + 1 }, (_, i) => [i, i] as const);
  const record = submitPrediction(beginPrompt(SPEC.promptId), { form: "sketch", points });
  assert.throws(() => buildPredictionTapeEvent(record, SPEC, "bm-05", 1), TapeValidationError);
});

test("a candidate id outside the prompt's authored candidates is rejected", () => {
  const record = submitPrediction(beginPrompt(SPEC.promptId), {
    form: "candidate",
    candidateId: "not-a-real-candidate",
  });
  assert.throws(() => buildPredictionTapeEvent(record, SPEC, "bm-05", 1), TapeValidationError);
});

test("a predicted-unrecorded prompt writes no event, and skipped writes no event either", () => {
  const unrecorded = keepToSelf(beginPrompt(SPEC.promptId));
  assert.equal(buildPredictionTapeEvent(unrecorded, SPEC, "bm-05", 1), null);
  assert.equal(buildPredictionTapeEvent(reveal(unrecorded), SPEC, "bm-05", 1), null);

  const skipped = skipPrediction(beginPrompt(SPEC.promptId));
  assert.equal(buildPredictionTapeEvent(skipped, SPEC, "bm-05", 1), null);
});

test("a permalink round trip restores no prediction for an unrecorded prompt while restoring another prompt's candidate unchanged", () => {
  const recordedA = reveal(
    submitPrediction(beginPrompt("prompt-a"), {
      form: "candidate",
      candidateId: "same-bell-shape",
    }),
  );
  const unrecordedB = reveal(keepToSelf(beginPrompt("prompt-b")));

  const eventA = buildPredictionTapeEvent(recordedA, { ...SPEC, promptId: "prompt-a" }, "bm-05", 1);
  const eventB = buildPredictionTapeEvent(
    unrecordedB,
    { ...SPEC, promptId: "prompt-b" },
    "bm-05",
    2,
  );

  assert.ok(eventA);
  assert.equal(eventB, null);

  // Simulating the permalink round trip: only prompt-a has an event to restore from.
  const restoredA = restorePromptFromTapeEvent(eventA);
  assert.deepEqual(restoredA.choice, { form: "candidate", candidateId: "same-bell-shape" });
});
