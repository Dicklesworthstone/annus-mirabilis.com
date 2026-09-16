import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ME02_PREDICT_PROMPT } from "../../experiments/me02/definition.ts";
import {
  amendAfterReveal,
  beginPrompt,
  reveal,
  submitPrediction,
} from "../../experiments/predict/predictState.ts";
import { PredictPanel } from "./PredictPanel.tsx";

const noop = () => undefined;

describe("PredictPanel", () => {
  test("hidden state offers three candidates and skip, with no score", () => {
    const html = renderToStaticMarkup(
      <PredictPanel
        prompt={ME02_PREDICT_PROMPT}
        record={beginPrompt(ME02_PREDICT_PROMPT.promptId)}
        onRecord={noop}
        onSkip={noop}
        onKeepToSelf={noop}
        onAmend={noop}
      />,
    );
    expect(html).toContain("Predict before the numbers");
    expect(html).toContain("Skip prediction");
    expect(html).toContain("I have one in mind");
    expect(html).toContain("Larger");
    expect(html).not.toContain("data-predict-adjudication");
  });

  test("after reveal a miss shows the separating assumption and not a score of the person", () => {
    const shown = reveal(
      submitPrediction(beginPrompt(ME02_PREDICT_PROMPT.promptId), {
        form: "candidate",
        candidateId: "equal",
      }),
    );
    const html = renderToStaticMarkup(
      <PredictPanel
        prompt={ME02_PREDICT_PROMPT}
        record={shown}
        onRecord={noop}
        onSkip={noop}
        onKeepToSelf={noop}
        onAmend={noop}
      />,
    );
    expect(html).toContain('data-predict-score="not-close"');
    expect(html).toContain("This is not the relation the model supports.");
    expect(html).toContain("The low-speed proxy is treated as exact at every speed.");
    expect(html.toLowerCase()).not.toContain("wrong");
    expect(html.toLowerCase()).not.toContain("you guessed");
  });

  test("an amendment after reveal is labeled after-the-fact and the original remains", () => {
    const shown = reveal(
      submitPrediction(beginPrompt(ME02_PREDICT_PROMPT.promptId), {
        form: "candidate",
        candidateId: "equal",
      }),
    );
    const amended = amendAfterReveal(shown, { form: "candidate", candidateId: "larger" });
    const html = renderToStaticMarkup(
      <PredictPanel
        prompt={ME02_PREDICT_PROMPT}
        record={amended}
        onRecord={noop}
        onSkip={noop}
        onKeepToSelf={noop}
        onAmend={noop}
      />,
    );
    expect(html).toContain("Recorded prediction: Equal");
    expect(html).toContain("data-predict-after-the-fact");
    expect(html).toContain("The original prediction is unchanged.");
  });
});
