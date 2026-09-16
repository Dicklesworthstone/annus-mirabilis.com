import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ControlTapeRecorder } from "../experiments/tapes/recorder.ts";
import {
  type PredictionPromptSpec,
  type TapeModelIdentity,
  TapeValidationError,
  validatePredictionPayload,
} from "../experiments/tapes/schema.ts";

const modelIdentity: TapeModelIdentity = {
  modelId: "brownian-motion-reference",
  modelVersion: "1.0.0",
  artifactDigest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const promptSpec: PredictionPromptSpec = {
  promptId: "prompt-prediction-all-forms",
  candidateIds: ["candidate-einstein-0-8", "candidate-classical-zero"],
  verbalChoices: {
    directionIds: ["positive-x", "symmetric"],
    shapeIds: ["gaussian-bell", "exponential-cusp"],
  },
  valueTargetIds: ["diffusivity", "particleRadius"],
  sketchAxisRanges: {
    x: [0, 60],
    y: [0, 10],
  },
};

describe("tapes.prediction: Four Prediction Forms and Schema Rejection Rules (am-rt-control-tapes-0gc)", () => {
  it("candidate form validates and round-trips correctly", () => {
    const payload = {
      form: "candidate",
      candidateId: "candidate-einstein-0-8",
    };
    const validated = validatePredictionPayload(payload, promptSpec, "test.candidate");
    assert.deepEqual(validated, payload);
  });

  it("sketch form validates, quantizes points, and round-trips correctly", () => {
    const rawPoints: [number, number][] = [
      [0, 0],
      [15.0004, 3.2001],
      [60, 6.16],
    ];
    const payload = {
      form: "sketch",
      points: rawPoints,
    };
    const validated = validatePredictionPayload(payload, promptSpec, "test.sketch");
    assert.equal(validated.form, "sketch");
    if (validated.form === "sketch") {
      const p1 = validated.points[1];
      assert.ok(p1);
      assert.ok(Math.abs(p1[0] - 15) < 0.1);
    }
  });

  it("verbal form validates direction and shape selections", () => {
    const payload = {
      form: "verbal",
      directionId: "symmetric",
      shapeId: "gaussian-bell",
    };
    const validated = validatePredictionPayload(payload, promptSpec, "test.verbal");
    assert.deepEqual(validated, payload);
  });

  it("values form validates and quantizes target values via recorder", () => {
    const recorder = new ControlTapeRecorder({
      tapeId: "prediction-values-tape",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      seed: "9007199254740993",
      streamVersion: 1,
      allocationId: "alloc-0",
      initialConditions: { diffusivity: 4.2944e-13, particleRadius: 5e-7 },
      quantizationPolicies: {
        diffusivity: { kind: "significant-figures", digits: 3 },
        particleRadius: { kind: "significant-figures", digits: 1 },
      },
    });

    const recorded = recorder.recordPredictionEvent({
      instrumentId: "bm-01",
      promptId: "prompt-prediction-all-forms",
      payload: {
        form: "values",
        targets: [
          { targetId: "diffusivity", value: 4.2944e-13 },
          { targetId: "particleRadius", value: 5.00001e-7 },
        ],
      },
      promptSpec,
    });
    assert.equal(recorded, true);

    const tape = recorder.getTape();
    const event = tape.events[0];
    assert.ok(event);
    assert.equal(event?.kind, "prediction");
    if (event?.kind === "prediction" && event.payload.form === "values") {
      const targets = event.payload.targets;
      assert.equal(targets[0]?.value, 4.29e-13);
      assert.equal(targets[1]?.value, 5e-7);
    }
  });

  it("rejects candidateId absent from the prompt", () => {
    assert.throws(
      () =>
        validatePredictionPayload(
          { form: "candidate", candidateId: "unknown-candidate" },
          promptSpec,
          "test.candidate",
        ),
      TapeValidationError,
    );
  });

  it("rejects verbal choices absent from the prompt", () => {
    assert.throws(
      () =>
        validatePredictionPayload(
          { form: "verbal", directionId: "invalid-direction", shapeId: "gaussian-bell" },
          promptSpec,
          "test.verbal",
        ),
      TapeValidationError,
    );
    assert.throws(
      () =>
        validatePredictionPayload(
          { form: "verbal", directionId: "symmetric", shapeId: "invalid-shape" },
          promptSpec,
          "test.verbal",
        ),
      TapeValidationError,
    );
  });

  it("rejects value targetId absent from the prompt", () => {
    assert.throws(
      () =>
        validatePredictionPayload(
          { form: "values", targets: [{ targetId: "unknown-target", value: 1.0 }] },
          promptSpec,
          "test.values",
        ),
      TapeValidationError,
    );
  });

  it("rejects sketch with more than 64 points", () => {
    const tooManyPoints = Array.from({ length: 65 }, (_, i) => [i, i]);
    assert.throws(
      () =>
        validatePredictionPayload(
          { form: "sketch", points: tooManyPoints },
          promptSpec,
          "test.sketch",
        ),
      TapeValidationError,
    );
  });

  it("rejects free-text fields in any prediction payload", () => {
    const forbidden = ["text", "note", "comment", "freeText", "answer"];
    for (const field of forbidden) {
      assert.throws(
        () =>
          validatePredictionPayload(
            {
              form: "candidate",
              candidateId: "candidate-einstein-0-8",
              [field]: "My rationale",
            },
            promptSpec,
            "test.freeText",
          ),
        TapeValidationError,
      );
    }
  });

  it("rejects unknown prediction form", () => {
    assert.throws(
      () =>
        validatePredictionPayload(
          { form: "free-essay", candidateId: "foo" },
          promptSpec,
          "test.form",
        ),
      TapeValidationError,
    );
  });
});
