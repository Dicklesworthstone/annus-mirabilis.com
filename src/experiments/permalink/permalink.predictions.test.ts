import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import type { TapePredictionEvent, TapeV2 } from "./types.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

const PREDICTION_TEST_CASES: readonly { name: string; event: TapePredictionEvent }[] = [
  {
    name: "candidate",
    event: {
      promptId: "prompt-bm01-which-distribution",
      form: "candidate",
      payload: { candidateId: "gaussian-spread-candidate" },
    },
  },
  {
    name: "sketch",
    event: {
      promptId: "prompt-bm01-draw-displacement",
      form: "sketch",
      payload: {
        points: [
          [0, 0],
          [0.2, 0.4],
          [0.4, 0.8],
          [0.6, 1.2],
          [0.8, 1.6],
        ],
      },
    },
  },
  {
    name: "verbal",
    event: {
      promptId: "prompt-bm01-verbal-summary",
      form: "verbal",
      payload: {
        choiceIndex: 2,
        choiceText: "Displacement variance increases linearly with time.",
      },
    },
  },
  {
    name: "values",
    event: {
      promptId: "prompt-bm01-predict-radius",
      form: "values",
      payload: {
        values: [
          [0, 0.5e-6],
          [1, 0.8e-6],
        ],
      },
    },
  },
];

for (const { name, event } of PREDICTION_TEST_CASES) {
  test(`permalink.predictions: prediction form "${name}" round-trips exactly`, () => {
    const tape: TapeV2 = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      predictions: [event],
    };

    const encoded = encodeTapePermalink(tape);
    const decoded = decodeTapePermalink(encoded);

    assert.equal(decoded.kind, "success");
    if (decoded.kind === "success") {
      assert.ok(decoded.tape.predictions);
      assert.equal(decoded.tape.predictions.length, 1);
      const restored = decoded.tape.predictions[0];
      assert.ok(restored);
      assert.equal(restored.promptId, event.promptId);
      assert.equal(restored.form, event.form);
      assert.deepEqual(restored.payload, event.payload);
    }

    logger.log({
      testId: `permalink-prediction-roundtrip-${name}`,
      beadId: "am-inst-permalink-tape-s677",
      outcome: "passed",
      message: `Prediction form ${name} preserved across permalink codec`,
    });
  });
}

test("permalink.predictions: free text in prediction payload is rejected by schema", () => {
  const rawWithFreeText = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    predictions: [
      {
        promptId: "prompt-test",
        form: "candidate",
        payload: {
          candidateId: "cand-1",
          freeText: "I think this will spread out because of kicks.", // Free text forbidden
        },
      },
    ],
  };

  const json = JSON.stringify(rawWithFreeText);
  const base64url = Buffer.from(json).toString("base64url");

  const result = decodeTapePermalink(base64url);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.equal(result.reason, "prediction-free-text-forbidden");
    assert.ok(result.notice.includes("free-text"));
  }

  logger.log({
    testId: "permalink-prediction-free-text-rejected",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Free text in prediction payloads rejected to prevent unstructured URL state leaks",
  });
});
