import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { containsHeading } from "../../testing/headingText.ts";
import { PredictOverlay } from "./PredictOverlay.tsx";

describe("PredictOverlay (am-inst-predict-mode-ti7m)", () => {
  test("renders null when there is no prediction and no result points", () => {
    const html = renderToStaticMarkup(<PredictOverlay choice={null} resultPoints={[]} />);
    expect(html).toBe("");
  });

  test("distinguishes prediction and result curves and markers without relying on color", () => {
    const html = renderToStaticMarkup(
      <PredictOverlay
        choice={{
          form: "sketch",
          points: [
            [0, 0],
            [1, 1],
          ],
        }}
        resultPoints={[
          [0, 0],
          [0.5, 0.7],
          [1, 1],
        ]}
        resultLabel="Stokes-Einstein model"
        xLabel="Time (s)"
        yLabel="Displacement (μm)"
      />,
    );

    // Non-color distinctions in SVG
    expect(html).toContain('data-overlay-curve="prediction"');
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain('data-overlay-marker="prediction-square"');

    expect(html).toContain('data-overlay-curve="result"');
    expect(html).toContain('data-overlay-marker="result-round"');

    // Non-color distinctions in legend
    expect(html).toContain("[■ - - -]");
    expect(html).toContain("[● ───]");

    // Screen reader accessible descriptions and figure
    expect(html).toContain('<figure class="predict-overlay"');
    expect(html).toContain('data-predict-overlay=""');
    expect(containsHeading(html, "Prediction and result comparison")).toBe(true);
    expect(html).toContain(
      "Distinguished by pattern: prediction is dashed with square markers; result is solid with circular markers.",
    );
  });

  test("renders clear button when onClear callback is provided", () => {
    // renderToStaticMarkup never dispatches events, so this checks only that supplying
    // onClear is what makes the control render. That the control actually clears the
    // comparison needs a test that can click, and there is not one yet.
    const html = renderToStaticMarkup(
      <PredictOverlay
        choice={{ form: "candidate", candidateId: "bm-01-predict-viscosity-root-two" }}
        resultPoints={[
          [0, 0],
          [1, 2],
        ]}
        onClear={() => {}}
      />,
    );

    expect(html).toContain("Clear comparison");
    expect(html).toContain("predict-overlay-clear");
  });

  test("handles verbal and values prediction descriptions accurately", () => {
    const verbalHtml = renderToStaticMarkup(
      <PredictOverlay
        choice={{
          form: "verbal",
          directionId: "increases",
          shapeId: "square-root",
        }}
        resultPoints={[
          [0, 0],
          [1, 1],
        ]}
      />,
    );
    expect(verbalHtml).toContain("Verbal: direction increases, shape square-root");

    const valuesHtml = renderToStaticMarkup(
      <PredictOverlay
        choice={{
          form: "values",
          targets: [{ targetId: "disp", value: 0.707 }],
        }}
        resultPoints={[
          [0, 0],
          [1, 1],
        ]}
      />,
    );
    expect(valuesHtml).toContain("Target values: disp=0.707");
    expect(valuesHtml).toContain('data-overlay-marker="prediction-square"');
  });
});
