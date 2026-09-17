import { describe, expect, test } from "bun:test";
import { ExperimentValidationError, validateScenario } from "../content/schemas/experiment.ts";

describe("rounds-to validation", () => {
  test("rounds-to on modern-golden fails", () => {
    expect(() =>
      validateScenario({
        id: "x",
        kind: "modern-golden",
        title: "x",
        constantSetId: "modern-si-2019",
        owner: "selfTest.timesTwoClosed",
        inputs: {},
        expected: {
          outputs: [
            {
              outputId: "value",
              comparisonKind: "rounds-to",
              printedValue: "2",
              printedPrecision: { significantFigures: 1 },
            },
          ],
        },
        modelVersion: 1,
        schemaVersion: 1,
      }),
    ).toThrow(ExperimentValidationError);
  });

  test("historical tolerance against a printed number fails naming comparisonKind", () => {
    try {
      validateScenario({
        id: "x",
        kind: "historical-fixture",
        title: "x",
        constantSetId: "modern-si-2019",
        owner: "selfTest.constant",
        provenance: { paper: "brownian-motion", sectionId: "s5", printedPage: 1 },
        transcription: { status: "verified", facsimilePage: 1 },
        inputs: {},
        expected: {
          outputs: [
            {
              outputId: "rmsDisplacement1d",
              value: 8e-7,
              comparisonKind: "tolerance",
              tolerance: { relative: 0.5, rationale: "too loose" },
            },
          ],
        },
        modelVersion: 1,
        schemaVersion: 1,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("historical-printed-requires-rounds-to");
      expect((err as ExperimentValidationError).path.includes("comparisonKind")).toBe(true);
    }
  });

  test("widening printedPrecision without facsimile page reference is rejected", () => {
    // "6.16" has 2 decimals, 3 sig figs. Declaring decimals: 1 widens the precision.
    try {
      validateScenario({
        id: "widened-fixture",
        kind: "historical-fixture",
        title: "Widened fixture without facsimile page",
        constantSetId: "modern-si-2019",
        owner: "selfTest.constant",
        provenance: { paper: "brownian-motion", sectionId: "s5", printedPage: 559 },
        transcription: { status: "pending", reason: "unreviewed" },
        inputs: {},
        expected: {
          outputs: [
            {
              outputId: "displacement",
              comparisonKind: "rounds-to",
              printedValue: "6.16",
              printedPrecision: { decimals: 1 },
            },
          ],
        },
        modelVersion: 1,
        schemaVersion: 1,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("rounds-to-widening-unreferenced");
      expect((err as ExperimentValidationError).path.includes("printedPrecision")).toBe(true);
    }
  });

  test("widening printedPrecision with facsimile page reference passes validation", () => {
    const validated = validateScenario({
      id: "widened-with-ref",
      kind: "historical-fixture",
      title: "Widened fixture with facsimile page",
      constantSetId: "modern-si-2019",
      owner: "selfTest.constant",
      provenance: { paper: "brownian-motion", sectionId: "s5", printedPage: 559 },
      transcription: { status: "verified", facsimilePage: 559 },
      inputs: {},
      expected: {
        outputs: [
          {
            outputId: "displacement",
            comparisonKind: "rounds-to",
            printedValue: "6.16",
            printedPrecision: { decimals: 1 },
          },
        ],
      },
      modelVersion: 1,
      schemaVersion: 1,
    });
    expect(validated.id).toBe("widened-with-ref");
  });
});
