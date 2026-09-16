import { describe, expect, test } from "bun:test";
import { ExperimentValidationError, validateScenario } from "../content/schemas/experiment.ts";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";

const golden = {
  id: "schema-golden",
  kind: "modern-golden",
  title: "x",
  constantSetId: "modern-si-2019",
  owner: "selfTest.timesTwoClosed",
  inputs: { x: { value: 1, unit: "1" } },
  expected: {
    outputs: [
      {
        outputId: "value",
        value: 2,
        comparisonKind: "tolerance",
        tolerance: { relative: 1e-9, rationale: "exact" },
      },
    ],
  },
  modelVersion: 1,
  schemaVersion: 1,
};

describe("scenario schema", () => {
  test("one scenario of each existing kind still loads", () => {
    const loaded = loadScenarios(defaultScenarioDirs());
    const kinds = new Set(loaded.map((item) => item.scenario.kind));
    expect(kinds.has("historical-fixture")).toBe(true);
    expect(kinds.has("modern-golden")).toBe(true);
    expect(kinds.has("identity")).toBe(true);
    expect(kinds.has("discrimination")).toBe(true);
    expect(kinds.has("adversarial")).toBe(true);
  });

  test("retired constantSet field is rejected", () => {
    expect(() =>
      validateScenario({ ...golden, constantSet: "modern-si-2019", constantSetId: undefined }),
    ).toThrow(ExperimentValidationError);
  });

  test("JSON-number seed is rejected", () => {
    expect(() => validateScenario({ ...golden, seed: 1 })).toThrow(ExperimentValidationError);
  });

  test("historical fixture without transcription is rejected", () => {
    expect(() =>
      validateScenario({
        ...golden,
        kind: "historical-fixture",
        provenance: { paper: "brownian-motion", sectionId: "s5", printedPage: 559 },
      }),
    ).toThrow(ExperimentValidationError);
  });

  test("historical fixture with tolerance instead of rounds-to is rejected", () => {
    try {
      validateScenario({
        ...golden,
        kind: "historical-fixture",
        provenance: { paper: "brownian-motion", sectionId: "s5", printedPage: 559 },
        transcription: { status: "verified", facsimilePage: 1 },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("historical-printed-requires-rounds-to");
    }
  });

  test("rounds-to on a modern-golden row is rejected", () => {
    expect(() =>
      validateScenario({
        ...golden,
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
      }),
    ).toThrow(ExperimentValidationError);
  });

  test("adversarial without intendedFailure is rejected", () => {
    expect(() =>
      validateScenario({
        ...golden,
        kind: "adversarial",
        plausibleMistake: "wrong",
      }),
    ).toThrow(ExperimentValidationError);
  });

  test("discrimination without hypotheses is rejected", () => {
    expect(() => validateScenario({ ...golden, kind: "discrimination" })).toThrow(
      ExperimentValidationError,
    );
  });

  test("editorial input without a source is rejected", () => {
    expect(() =>
      validateScenario({
        ...golden,
        editorialInputs: [
          { quantityId: "molarGasConstant", value: 8.31, unit: "J/(mol K)", reason: "x" },
        ],
      }),
    ).toThrow(ExperimentValidationError);
  });
});
