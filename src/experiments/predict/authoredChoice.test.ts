import { describe, expect, test } from "bun:test";
import { type GeneratedPredictPrompt, PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { BM06_DEFAULTS } from "../bm06/definition.ts";
import { BM06_DRAFT_TAPE } from "../bm06/draftTape.ts";
import { BM06_CURVE_PROMPT } from "../bm06/prediction.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { draftTapeForSettings, loadDraftTape } from "../permalink/draftTape.ts";
import {
  checkedPredictionChoice,
  predictionForLink,
  predictionFromLink,
} from "./authoredChoice.ts";
import type { PredictionChoice } from "./predictState.ts";

const prompt = PREDICT_PROMPTS["bm-06"]?.find(
  (entry) => entry.promptId === BM06_CURVE_PROMPT,
) as GeneratedPredictPrompt;
const values: PredictionChoice = {
  form: "values",
  targets: [
    { targetId: "at-zero", value: 0.4 },
    { targetId: "at-one", value: 0.24 },
    { targetId: "at-two", value: 0.05 },
  ],
};

describe("the live authored density prediction", () => {
  test("supports a choice, a bounded sketch and complete named values", () => {
    expect(prompt.curvePrediction).toBeDefined();
    expect(checkedPredictionChoice(values, prompt)).toEqual(values);
    expect(
      checkedPredictionChoice(
        { form: "candidate", candidateId: prompt.supportedCandidateId },
        prompt,
      ),
    ).toEqual({ form: "candidate", candidateId: prompt.supportedCandidateId });
    const sketch = checkedPredictionChoice(
      {
        form: "sketch",
        points: [
          [-4, 0],
          [0, 0.4],
          [4, 0],
        ],
      },
      prompt,
    );
    expect(sketch).toEqual({
      form: "sketch",
      points: [
        [-4, 0],
        [0, 0.4],
        [4, 0],
      ],
    });
  });

  test("incomplete, duplicate, nonfinite and out-of-domain values are refused without filling defaults", () => {
    if (values.form !== "values") return;
    for (const targets of [
      [],
      values.targets.slice(1),
      [values.targets[0], values.targets[0], values.targets[2]],
      [...values.targets.slice(0, 2), { targetId: "at-two", value: 0.51 }],
      [...values.targets.slice(0, 2), { targetId: "at-two", value: Number.NaN }],
      [...values.targets.slice(0, 2), { targetId: "unexpected", value: 0.2 }],
    ]) {
      expect(checkedPredictionChoice({ form: "values", targets }, prompt)).toBeNull();
    }
  });

  test("empty, out-of-axis and nonfinite sketches and unauthored formats never restore", () => {
    for (const points of [
      [],
      [[0, Number.POSITIVE_INFINITY]],
      [[5, 0]],
      [[4.0001, 0]],
      [[0, 0.50001]],
      [[0, -0.1]],
      Array.from({ length: 65 }, () => [0, 0.1]),
    ])
      expect(checkedPredictionChoice({ form: "sketch", points }, prompt)).toBeNull();
    expect(
      checkedPredictionChoice(
        { form: "verbal", directionId: "increases", shapeId: "linear" },
        prompt,
      ),
    ).toBeNull();
    const candidateOnly = PREDICT_PROMPTS["bm-01"]?.[0] as GeneratedPredictPrompt;
    expect(checkedPredictionChoice({ form: "sketch", points: [[0, 0]] }, candidateOnly)).toBeNull();
    expect(
      predictionFromLink(
        { promptId: prompt.promptId, form: "values", payload: { values: [[0, 0.4]] } },
        prompt,
      ),
    ).toBeNull();
    expect(predictionFromLink(predictionForLink("different-prompt", values), prompt)).toBeNull();
  });

  test("sharing the accepted settings preserves every named value and loading produces a draft", () => {
    const tape = draftTapeForSettings(BM06_DRAFT_TAPE, BM06_DEFAULTS);
    expect(tape).not.toBeNull();
    if (!tape) return;
    const shared = { ...tape, predictions: [predictionForLink(prompt.promptId, values)] };
    const encoded = encodeTapePermalink(shared);
    const decoded = decodeTapePermalink(encoded);
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return;
    const loaded = loadDraftTape(BM06_DRAFT_TAPE, decoded.tape);
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind !== "loaded") return;
    expect(loaded.settings).toEqual(BM06_DEFAULTS);
    expect(loaded.predictions).toEqual(shared.predictions);
    expect(
      predictionFromLink(
        loaded.predictions?.[0] as NonNullable<typeof loaded.predictions>[number],
        prompt,
      ),
    ).toEqual(values);
  });
});
