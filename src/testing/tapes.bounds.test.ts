import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ControlTapeRecorder } from "../experiments/tapes/recorder.ts";
import {
  MAX_TAPE_EVENTS,
  type PredictionPromptSpec,
  type TapeModelIdentity,
  TapeValidationError,
  validateControlTape,
} from "../experiments/tapes/schema.ts";

const modelIdentity: TapeModelIdentity = {
  modelId: "brownian-motion-reference",
  modelVersion: "1.0.0",
  artifactDigest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const promptSpec: PredictionPromptSpec = {
  promptId: "prompt-bounds-test",
  candidateIds: ["cand-1"],
  verbalChoices: { directionIds: [], shapeIds: [] },
  valueTargetIds: [],
};

describe("tapes.bounds: Event Bound Enforcement and Notice Triggers (am-rt-control-tapes-0gc)", () => {
  it("recorder stops at MAX_TAPE_EVENTS (3600), fires notice, and does not drop events silently", () => {
    let noticeFired = false;
    const recorder = new ControlTapeRecorder({
      tapeId: "bounds-tape",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      seed: "1",
      streamVersion: 1,
      allocationId: "alloc-0",
      initialConditions: { x: 0 },
      onBoundExceeded: () => {
        noticeFired = true;
      },
    });

    // Record exactly 3600 events
    for (let i = 0; i < MAX_TAPE_EVENTS; i++) {
      const recorded = recorder.recordControlEvent({
        commandClass: "setup-change",
        commandId: `step-${i}`,
        parameterId: "x",
        value: i,
      });
      assert.equal(recorded, true);
    }

    assert.equal(recorder.getEvents().length, MAX_TAPE_EVENTS);
    assert.equal(recorder.hasExceededEventBound, false);
    assert.equal(noticeFired, false);

    // Attempting 3601st event fails and triggers notice
    const event3601 = recorder.recordControlEvent({
      commandClass: "setup-change",
      commandId: "step-overflow",
      parameterId: "x",
      value: 9999,
    });
    assert.equal(event3601, false);
    assert.equal(recorder.hasExceededEventBound, true);
    assert.equal(noticeFired, true);

    // Prediction also refused when bound is reached
    const predOverflow = recorder.recordPredictionEvent({
      instrumentId: "bm-01",
      promptId: "prompt-bounds-test",
      payload: { form: "candidate", candidateId: "cand-1" },
      promptSpec,
    });
    assert.equal(predOverflow, false);

    // Tape remains valid at exactly 3600 events
    const tape = recorder.getTape();
    assert.equal(tape.events.length, MAX_TAPE_EVENTS);
  });

  it("schema validator rejects raw tape with more than 3600 events", () => {
    const rawEvents = Array.from({ length: MAX_TAPE_EVENTS + 1 }, (_, i) => ({
      kind: "control" as const,
      actionIndex: i + 1,
      commandClass: "setup-change" as const,
      commandId: `event-${i}`,
      parameterId: "x",
      value: i,
    }));

    assert.throws(
      () =>
        validateControlTape({
          tapeVersion: 2,
          tapeId: "overflow-tape",
          experimentId: "bm-01",
          mode: "bm-01:default",
          modelIdentity,
          constantSetId: "einstein-1905-brownian-printed",
          seed: "1",
          streamVersion: 1,
          allocationId: "alloc-0",
          initialConditions: { x: 0 },
          events: rawEvents,
          checkpoints: [],
        }),
      TapeValidationError,
    );
  });
});
