import { describe, expect, test } from "bun:test";
import { ExperimentValidationError, validateScenario } from "../content/schemas/experiment.ts";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";
import { getOwner } from "./scenario-registry/owners.ts";

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

  test("mixed constant sets without constantSetMixing is rejected", () => {
    try {
      validateScenario({
        ...golden,
        constantSets: ["modern-si-2019", "einstein-1905-brownian-printed"],
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("mixed-constant-sets-forbidden");
    }

    try {
      validateScenario({
        ...golden,
        inputs: {
          x: { value: 1, unit: "1", constantSetId: "einstein-1905-brownian-printed" },
        },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("mixed-constant-sets-forbidden");
    }
  });

  test("invalid constantSetMixing is rejected", () => {
    expect(() =>
      validateScenario({
        ...golden,
        constantSetMixing: { declared: false, reason: "invalid" },
      }),
    ).toThrow(ExperimentValidationError);

    expect(() =>
      validateScenario({
        ...golden,
        constantSetMixing: { declared: true, reason: "" },
      }),
    ).toThrow(ExperimentValidationError);
  });

  test("valid constantSetMixing passes", () => {
    const validated = validateScenario({
      ...golden,
      constantSets: ["modern-si-2019", "einstein-1905-brownian-printed"],
      constantSetMixing: {
        declared: true,
        reason: "modern k_B with printed viscosity for comparison",
      },
    });
    expect(validated.constantSetMixing?.declared).toBe(true);
    expect(validated.constantSetMixing?.reason).toBe(
      "modern k_B with printed viscosity for comparison",
    );
  });

  test("missing tolerance spec on tolerance comparison is rejected", () => {
    try {
      validateScenario({
        ...golden,
        expected: {
          outputs: [
            {
              outputId: "value",
              value: 2,
              comparisonKind: "tolerance",
            },
          ],
        },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("tolerance-comparison-missing-spec");
    }
  });

  test("invalid comparisonKind is rejected", () => {
    try {
      validateScenario({
        ...golden,
        expected: {
          outputs: [
            {
              outputId: "value",
              value: 2,
              comparisonKind: "unrecognized-kind",
            },
          ],
        },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("invalid-comparison-kind");
    }
  });

  test("tolerance spec that fails validateToleranceSpec is rejected", () => {
    // Valid tolerance is accepted
    expect(() =>
      validateScenario({
        ...golden,
        expected: {
          outputs: [
            {
              outputId: "value",
              value: 2,
              comparisonKind: "tolerance",
              tolerance: { relative: 1e-6, rationale: "exact tolerance" },
            },
          ],
        },
      }),
    ).not.toThrow();

    // Negative relative tolerance
    try {
      validateScenario({
        ...golden,
        expected: {
          outputs: [
            {
              outputId: "value",
              value: 2,
              comparisonKind: "tolerance",
              tolerance: { relative: -0.05, rationale: "negative relative" },
            },
          ],
        },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("tolerance-spec-invalid");
      expect((err as ExperimentValidationError).message).toContain(
        "must be a finite number in [0, 1)",
      );
    }

    // Zero tolerance without bitwise
    try {
      validateScenario({
        ...golden,
        expected: {
          outputs: [
            {
              outputId: "value",
              value: 2,
              comparisonKind: "tolerance",
              tolerance: { relative: 0, absolute: 0, rationale: "neither positive" },
            },
          ],
        },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("tolerance-spec-invalid");
      expect((err as ExperimentValidationError).message).toContain(
        "Neither absolute nor relative tolerance is positive",
      );
    }
  });

  test("discrimination tolerance spec that fails validateToleranceSpec is rejected, accepted with valid spec", () => {
    const validDiscrimination = {
      id: "schema-discrimination-tolerance",
      kind: "discrimination" as const,
      title: "Discrimination tolerance test",
      constantSetId: "modern-si-2019",
      owner: "selfTest.fresnelDrag",
      hypotheses: [
        {
          id: "a",
          label: "a",
          owner: "selfTest.fresnelDrag",
          modelIdentity: "a",
          circumstancesInWhichItWorks: "a",
          historicalStatus: "available-before-cutoff" as const,
        },
        {
          id: "b",
          label: "b",
          owner: "selfTest.relativisticDrag",
          modelIdentity: "b",
          circumstancesInWhichItWorks: "b",
          historicalStatus: "later-development" as const,
        },
      ],
      observation: { observableId: "increment", inputs: {}, procedure: "x" },
      tolerance: { relative: 1e-6, rationale: "apparatus resolution limit" },
      expected: { outcome: "indistinguishable" as const },
      modelVersion: 1,
      schemaVersion: 1,
    };

    // Valid discrimination tolerance is accepted
    expect(() => validateScenario(validDiscrimination)).not.toThrow();

    // Negative relative tolerance is rejected
    try {
      validateScenario({
        ...validDiscrimination,
        tolerance: { relative: -0.05, rationale: "apparatus resolution limit" },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("tolerance-spec-invalid");
      expect((err as ExperimentValidationError).message).toContain(
        "must be a finite number in [0, 1)",
      );
    }

    // Zero tolerance without bitwise is rejected
    try {
      validateScenario({
        ...validDiscrimination,
        tolerance: { relative: 0, absolute: 0, rationale: "apparatus resolution limit" },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ExperimentValidationError);
      expect((err as ExperimentValidationError).code).toBe("tolerance-spec-invalid");
      expect((err as ExperimentValidationError).message).toContain(
        "Neither absolute nor relative tolerance is positive",
      );
    }
  });

  test("unknown owner throws actionable error", () => {
    expect(() => getOwner("nonexistent.evaluator.function")).toThrow(
      'Unknown scenario owner "nonexistent.evaluator.function".',
    );
  });
});
