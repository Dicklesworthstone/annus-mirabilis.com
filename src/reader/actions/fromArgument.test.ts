import { describe, expect, test } from "bun:test";
import type { Argument } from "../../content/schemas/reading.ts";
import { passageActionsFromArgument } from "./fromArgument.ts";

const ARG: Argument = {
  schemaVersion: 1,
  kind: "argument",
  id: "arg-bm-observable",
  paper: "brownian-motion",
  section: "s4",
  title: "Zero average is not no movement",
  question: "What can we measure when left and right cancel?",
  recap: "Signed displacements can cancel.",
  review: "draft",
  premises: [],
  limitations: [],
  citations: [],
  readings: { overview: [], full: [], steps: [], margin: [] },
  prerequisites: [],
  help: {
    why: "mean-variance-rms",
    missingStep: "bridge-squaring-square-roots",
    example: "mean-variance-rms",
  },
  experiments: ["bm-01"],
  meaning: {
    logicalRole: "definition",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
};

describe("passageActionsFromArgument", () => {
  test("the observable argument exposes why, example, try-it, and two authored obstacles", () => {
    const actions = passageActionsFromArgument(ARG);
    expect(actions.hard).toBe(true);
    expect(actions.why).toBe("mean-variance-rms");
    expect(actions.tryIt).toEqual({ kind: "instrument", instrumentId: "bm-01" });
    expect(actions.obstacleResponses?.algebraicMove?.foundationLinks?.[0]?.foundationId).toBe(
      "bridge-squaring-square-roots",
    );
    expect(actions.obstacleResponses?.unfamiliarWordOrSymbol).toBeUndefined();
  });

  test("planted negative: a different argument does not inherit invented obstacle answers", () => {
    const actions = passageActionsFromArgument({ ...ARG, id: "arg-bm-independent-steps" });
    expect(actions.hard).toBe(false);
    expect(actions.obstacleResponses).toBeUndefined();
    expect(actions.why).toBe("mean-variance-rms");
  });
});
