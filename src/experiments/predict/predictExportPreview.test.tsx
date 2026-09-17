import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PredictExportPreview } from "../../components/lab/PredictExportPreview.tsx";
import {
  emptyPredictionsDocument,
  recordPrediction,
  recordUnrecordedStatus,
  withoutPredictions,
} from "./predictStorage.ts";

describe("predictExportPreview (am-inst-predict-mode-ti7m)", () => {
  const fixtureLookups = {
    "bm-01": {
      "bm-01-predict-observation-interval": {
        question:
          "If you watch four times as long, does the typical distance become 4 times, 2 times, or unchanged?",
        candidateLabelById: {
          "bm-01-predict-observation-interval-twice": "Two times as large",
          "bm-01-predict-observation-interval-four-times": "Four times as large",
        },
      },
      "bm-01-predict-viscosity": {
        question:
          "In a liquid twice as viscous, does the distance become half as large, 0.71 times, or unchanged?",
        candidateLabelById: {
          "bm-01-predict-viscosity-half": "Half as large",
        },
      },
    },
  };

  test("the preview lists prompts and choices from the real stored document", () => {
    let doc = emptyPredictionsDocument();
    doc = recordPrediction(doc, "bm-01", "bm-01-predict-observation-interval", {
      form: "candidate",
      candidateId: "bm-01-predict-observation-interval-twice",
    });

    const html = renderToStaticMarkup(
      <PredictExportPreview doc={doc} lookups={fixtureLookups} includePredictions={true} />,
    );

    expect(html).toContain("If you watch four times as long");
    expect(html).toContain("Two times as large");
    expect(html).toContain("Predictions to be exported (1)");
  });

  test("predicted-unrecorded prompts show the 'kept to yourself, not recorded' line", () => {
    let doc = emptyPredictionsDocument();
    doc = recordUnrecordedStatus(doc, "bm-01", "bm-01-predict-viscosity", "predicted-unrecorded");

    const html = renderToStaticMarkup(
      <PredictExportPreview doc={doc} lookups={fixtureLookups} includePredictions={true} />,
    );

    expect(html).toContain("In a liquid twice as viscous");
    expect(html).toContain("kept to yourself, not recorded");
  });

  test("leaving predictions out produces an export containing none of the fixture prediction values", () => {
    let doc = emptyPredictionsDocument();
    doc = recordPrediction(doc, "bm-01", "bm-01-predict-observation-interval", {
      form: "candidate",
      candidateId: "bm-01-predict-observation-interval-twice",
    });
    doc = recordPrediction(doc, "bm-01", "bm-01-predict-viscosity", {
      form: "candidate",
      candidateId: "bm-01-predict-viscosity-half",
    });

    // When stripped via withoutPredictions
    const stripped = withoutPredictions(doc);
    expect(Object.keys(stripped.prompts).length).toBe(0);

    // When rendered with includePredictions={false}
    const html = renderToStaticMarkup(
      <PredictExportPreview doc={doc} lookups={fixtureLookups} includePredictions={false} />,
    );

    expect(html).toContain("Predictions are omitted from this export.");
    expect(html).not.toContain("Two times as large");
    expect(html).not.toContain("Half as large");
    expect(html).not.toContain("bm-01-predict-observation-interval");
    expect(html).not.toContain("bm-01-predict-viscosity");
  });
});
