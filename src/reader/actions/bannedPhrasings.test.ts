import { describe, expect, test } from "bun:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import type { Argument } from "../../content/schemas/reading.ts";
import { findBannedObstaclePhrases } from "./bannedPhrasings.ts";
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

describe("obstacle copy voice", () => {
  test("the Brownian observable obstacle answers carry no banned phrasing", () => {
    const actions = passageActionsFromArgument(ARG);
    const texts = [
      actions.obstacleResponses?.algebraicMove?.explanation ?? "",
      actions.obstacleResponses?.purposeOfCalculation?.explanation ?? "",
    ];
    for (const text of texts) {
      expect(findBannedObstaclePhrases(text)).toEqual([]);
      expect(checkVoice(text, { context: "prose" }).map((f) => f.rule)).toEqual([]);
    }
  });

  test("planted negative: level-assignment copy fails the voice lint", () => {
    const findings = checkVoice("Choose your level before continuing.", { context: "ui-label" });
    expect(findings.some((f) => f.rule === "level-assignment")).toBe(true);
  });

  test("planted negative: self-diagnosis copy fails this bead's obstacle list", () => {
    expect(findBannedObstaclePhrases("Tell us if you have a learning disability.")).toEqual([
      "learning disability",
    ]);
  });
});
