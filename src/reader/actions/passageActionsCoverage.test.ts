import { describe, expect, test } from "bun:test";
import type { Argument } from "../../content/schemas/reading.ts";
import { passageActionsFromArgument } from "./fromArgument.ts";
import { OBSTACLE_KIND_IDS, validatePassageActions } from "./passageActions.schema.ts";
import { reportPassageActionsCoverage } from "./passageActionsCoverage.ts";

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

describe("reportPassageActionsCoverage", () => {
  test("the Brownian observable fixture flags only the four unauthored obstacle kinds", () => {
    const gaps = reportPassageActionsCoverage([
      {
        paper: "brownian-motion",
        argumentId: "arg-bm-observable",
        actions: passageActionsFromArgument(ARG),
      },
    ]);
    expect(gaps.every((g) => g.rule === "hard-passage-missing-obstacle")).toBe(true);
    expect(gaps.map((g) => g.obstacleKind).sort()).toEqual(
      ["connectionToPicture", "physicalReason", "tooMuchAtOnce", "unfamiliarWordOrSymbol"].sort(),
    );
  });

  test("planted negative: a complete hard record and an example-bearing derivation emit no gaps", () => {
    const responses = Object.fromEntries(
      OBSTACLE_KIND_IDS.map((kind) => [kind, { explanation: `${kind} is authored.` }]),
    );
    const gaps = reportPassageActionsCoverage([
      {
        paper: "brownian-motion",
        argumentId: "arg-complete",
        abstractDerivation: true,
        actions: validatePassageActions({
          hard: true,
          example: "mean-variance-rms",
          obstacleResponses: responses,
        }),
      },
    ]);
    expect(gaps).toEqual([]);
  });

  test("an abstract derivation without an example is listed", () => {
    const gaps = reportPassageActionsCoverage([
      {
        paper: "brownian-motion",
        argumentId: "arg-abstract",
        abstractDerivation: true,
        actions: validatePassageActions({ hard: false }),
      },
    ]);
    expect(gaps).toEqual([
      {
        severity: "flag",
        rule: "abstract-derivation-missing-example",
        paper: "brownian-motion",
        argumentId: "arg-abstract",
        message: 'Abstract derivation arg-abstract has no "Show me one example first" target.',
        repair: "Author an example foundation or static instance for this passage.",
      },
    ]);
  });

  test("reject: (passageActionsCoverage.ts:41) hard passage missing obstacle responses emits hard-passage-missing-obstacle", () => {
    const gaps = reportPassageActionsCoverage([
      {
        paper: "brownian-motion",
        argumentId: "arg-unanswered",
        actions: validatePassageActions({ hard: true }),
      },
    ]);
    expect(gaps.some((g) => g.rule === "hard-passage-missing-obstacle")).toBe(true);
  });
});
