import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ExperimentValidationError,
  validateExperiment,
  validateScenario,
} from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import {
  conductorFrameEmf,
  fresnelDraggedIncrement,
  magnetFrameEmf,
  relativisticDraggedIncrement,
} from "../scenario-fixtures/evaluator.ts";
import {
  compareHypotheses,
  guard1904Shelf,
  renderDiscriminationSentence,
} from "../scenario-registry/discrimination.ts";
import { scenarioKindLabel } from "../scenario-registry/labels.ts";
import { defaultScenarioDirs, loadScenarios } from "../scenario-registry/load.ts";
import { runScenariosIsolated } from "../scenario-registry/run.ts";

const C = 299792458;

describe("discrimination scenarios", () => {
  test("the three requirement-11 scenarios match independently written references", () => {
    const loaded = loadScenarios(defaultScenarioDirs()).filter((item) =>
      [
        "sr-02-emf-first-order-agreement",
        "sr-02-emf-discriminates-at-0.6c",
        "shelf-fizeau-fresnel-versus-relativistic",
      ].includes(item.scenario.id),
    );
    const { results } = runScenariosIsolated(loaded);
    const byId = Object.fromEntries(results.map((r) => [r.scenarioId, r]));
    expect(byId["sr-02-emf-first-order-agreement"]?.status).toBe("passed");
    expect(byId["sr-02-emf-discriminates-at-0.6c"]?.status).toBe("passed");
    expect(byId["shelf-fizeau-fresnel-versus-relativistic"]?.status).toBe("passed");

    const emfA = magnetFrameEmf(1, 10, 0.1);
    const emfB = conductorFrameEmf(1, 10, 0.1, C);
    expect(Math.abs(emfB / emfA - 1)).toBeCloseTo(5.56325e-16, 6);
    const hiA = magnetFrameEmf(1, 0.6 * C, 0.1);
    const hiB = conductorFrameEmf(1, 0.6 * C, 0.1, C);
    expect(hiB / hiA).toBeCloseTo(1.25, 10);
    const f = fresnelDraggedIncrement(1.333, 7.06);
    const r = relativisticDraggedIncrement(1.333, 7.06, C);
    expect(Math.abs(f - r) / f).toBeCloseTo(1.767e-8, 2);
  });

  test("same-owner hypotheses are rejected", () => {
    expect(() =>
      validateScenario({
        id: "bad-same-owner",
        kind: "discrimination",
        title: "x",
        constantSetId: "modern-si-2019",
        owner: "selfTest.fresnelDrag",
        hypotheses: [
          {
            id: "a",
            label: "a",
            owner: "selfTest.fresnelDrag",
            modelIdentity: "a",
            circumstancesInWhichItWorks: "a",
            historicalStatus: "available-before-cutoff",
          },
          {
            id: "b",
            label: "b",
            owner: "selfTest.fresnelDrag",
            modelIdentity: "b",
            circumstancesInWhichItWorks: "b",
            historicalStatus: "available-before-cutoff",
          },
        ],
        observation: { observableId: "increment", inputs: {}, procedure: "x" },
        tolerance: {
          relative: 1e-6,
          rationale: "apparatus resolution limit",
        },
        expected: { outcome: "indistinguishable" },
        modelVersion: 1,
        schemaVersion: 1,
      }),
    ).toThrow("discrimination-hypotheses-same-owner");
  });

  test("a stored residual literal is rejected", () => {
    expect(() =>
      validateScenario({
        id: "bad-literal",
        kind: "discrimination",
        title: "x",
        constantSetId: "modern-si-2019",
        owner: "selfTest.fresnelDrag",
        hypotheses: [
          {
            id: "a",
            label: "a",
            owner: "selfTest.fresnelDrag",
            modelIdentity: "a",
            circumstancesInWhichItWorks: "a",
            historicalStatus: "available-before-cutoff",
          },
          {
            id: "b",
            label: "b",
            owner: "selfTest.relativisticDrag",
            modelIdentity: "b",
            circumstancesInWhichItWorks: "b",
            historicalStatus: "later-development",
          },
        ],
        observation: { observableId: "increment", inputs: {}, procedure: "x" },
        tolerance: {
          relative: 1e-6,
          rationale: "apparatus resolution limit",
        },
        expected: { outcome: "indistinguishable", residual: 1.767e-8 },
        modelVersion: 1,
        schemaVersion: 1,
      }),
    ).toThrow("discrimination-indistinguishable-stored-residual");
  });

  test("AC 24: discrimination scenario requires tolerance block", () => {
    const baseValid = {
      id: "test-discrimination-ac24",
      kind: "discrimination" as const,
      title: "Tolerance test",
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
      expected: { outcome: "indistinguishable" as const },
      modelVersion: 1,
      schemaVersion: 1,
    };

    // Missing tolerance fails
    expect(() => validateScenario(baseValid)).toThrow(/discrimination-missing-tolerance/);

    // With valid tolerance passes
    expect(() =>
      validateScenario({
        ...baseValid,
        tolerance: {
          relative: 1e-6,
          rationale: "apparatus resolution of 1e-6",
        },
      }),
    ).not.toThrow();
  });

  test("AC 26: discrimination scenario id matching registered preset id fails", () => {
    const colliding = {
      id: "sr-02-apparatus", // Matches registered preset id from content/experiments/sr-02.yaml
      kind: "discrimination" as const,
      title: "Preset collision",
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
      tolerance: {
        relative: 1e-6,
        rationale: "apparatus resolution of 1e-6",
      },
      expected: { outcome: "indistinguishable" as const },
      modelVersion: 1,
      schemaVersion: 1,
    };

    expect(() => validateScenario(colliding)).toThrow(/discrimination-preset-id-collision/);

    // Non-colliding id passes
    expect(() =>
      validateScenario({ ...colliding, id: "sr-02-unique-discrimination-noncolliding" }),
    ).not.toThrow();
  });

  test("AC 27: tolerance without rationale fails; rationale naming apparatus resolution, numerical bound, or observational uncertainty passes", () => {
    const makeWithRationale = (rationale?: unknown) => ({
      id: "test-tolerance-rationale",
      kind: "discrimination" as const,
      title: "Rationale test",
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
      tolerance: {
        relative: 1e-6,
        ...(rationale !== undefined ? { rationale } : {}),
      },
      expected: { outcome: "indistinguishable" as const },
      modelVersion: 1,
      schemaVersion: 1,
    });

    // Missing rationale fails
    expect(() => validateScenario(makeWithRationale())).toThrow(
      /discrimination-invalid-tolerance-rationale/,
    );

    // Generic uninformative rationale fails
    expect(() => validateScenario(makeWithRationale("a generic explanation"))).toThrow(
      /discrimination-invalid-tolerance-rationale/,
    );

    // Apparatus resolution passes
    expect(() =>
      validateScenario(makeWithRationale("apparatus resolution of 1.0e-6")),
    ).not.toThrow();

    // Numerical bound passes
    expect(() =>
      validateScenario(makeWithRationale("numerical bound from first-order Taylor expansion")),
    ).not.toThrow();

    // Stated observational uncertainty passes
    expect(() =>
      validateScenario(makeWithRationale("stated observational uncertainty in optical fringes")),
    ).not.toThrow();

    // Runner fails when tolerance rationale is invalid
    const loaded = loadScenarios(defaultScenarioDirs()).filter(
      (item) => item.scenario.id === "sr-02-emf-first-order-agreement",
    );
    const item = loaded[0];
    if (!item) throw new Error("Missing test fixture");
    const badRunnerItem = {
      ...item,
      scenario: {
        ...item.scenario,
        tolerance: { relative: 1e-12, rationale: "arbitrary rationale" },
      },
      raw: {
        ...item.raw,
        tolerance: { relative: 1e-12, rationale: "arbitrary rationale" },
      },
    };
    const { results } = runScenariosIsolated([badRunnerItem]);
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.message).toContain(
      "A discrimination tolerance requires a rationale naming an apparatus resolution, a numerical bound, or a stated observational uncertainty.",
    );
  });

  test("AC 28: runner computes predictions and fails on outcome mismatch", () => {
    const loaded = loadScenarios(defaultScenarioDirs()).filter((item) =>
      ["sr-02-emf-first-order-agreement", "sr-02-emf-discriminates-at-0.6c"].includes(
        item.scenario.id,
      ),
    );
    const agreementItem = loaded.find((i) => i.scenario.id === "sr-02-emf-first-order-agreement");
    const discriminatesItem = loaded.find(
      (i) => i.scenario.id === "sr-02-emf-discriminates-at-0.6c",
    );
    if (!agreementItem || !discriminatesItem) {
      throw new Error("Missing requirement-11 test fixtures.");
    }

    // Agreement fixture expects indistinguishable; mutate to expect discriminates -> must fail
    const mismatchA = {
      ...agreementItem,
      scenario: {
        ...agreementItem.scenario,
        expected: { outcome: "discriminates" as const },
      },
    };
    const resA = runScenariosIsolated([mismatchA]).results[0];
    expect(resA?.status).toBe("failed");
    expect(resA?.message).toBe(
      "Discrimination expected discriminates but computed indistinguishable.",
    );

    // Discriminates fixture expects discriminates; mutate to expect indistinguishable -> must fail
    const mismatchB = {
      ...discriminatesItem,
      scenario: {
        ...discriminatesItem.scenario,
        expected: { outcome: "indistinguishable" as const },
      },
    };
    const resB = runScenariosIsolated([mismatchB]).results[0];
    expect(resB?.status).toBe("failed");
    expect(resB?.message).toBe(
      "Discrimination expected indistinguishable but computed discriminates.",
    );
  });

  test("AC 29: difference in tolerance module boundary band reports indeterminate and fails", () => {
    // Direct comparison: difference sits exactly at the boundary band around allowed
    const spec = {
      relative: 1e-6,
      boundaryBand: { absolute: 1e-9, scale: 1e-6 },
      rationale: "apparatus resolution test",
    };
    // Let a = 1.0, b = 1.0 + 1.0000001e-6 -> diff is ~1.0000001e-6, allowed is 1e-6
    // diff - allowed = 1e-13, which is within boundary band absolute 1e-9
    const compared = compareHypotheses(1.0, 1.0 + 1.0000001e-6, spec);
    expect(compared.outcome).toBe("indeterminate");
    expect(compared.verdictKind).toBe("boundary-band-indeterminate");

    // Runner integration: an indeterminate outcome fails the scenario and never passes
    const loaded = loadScenarios(defaultScenarioDirs()).find(
      (item) => item.scenario.id === "sr-02-emf-first-order-agreement",
    );
    if (!loaded) {
      throw new Error("Missing sr-02-emf-first-order-agreement fixture.");
    }
    // Computed difference in IEEE-754 is 3*EPSILON = 6.661338147750939e-16; set tolerance equal with boundary band
    const boundaryItem = {
      ...loaded,
      scenario: {
        ...loaded.scenario,
        tolerance: {
          relative: 6.661338147750939e-16,
          boundaryBand: { absolute: 1e-16, scale: 6.661338147750939e-16 },
          rationale: "apparatus resolution at boundary",
        },
      },
      raw: {
        ...loaded.raw,
        tolerance: {
          relative: 6.661338147750939e-16,
          boundaryBand: { absolute: 1e-16, scale: 6.661338147750939e-16 },
          rationale: "apparatus resolution at boundary",
        },
      },
    };
    const res = runScenariosIsolated([boundaryItem]).results[0];
    expect(res?.status).toBe("failed");
    expect(res?.message).toBe(
      "Discrimination difference sits in the tolerance boundary band (indeterminate).",
    );
  });

  test("AC 30: hypothesis with later-development cited in 1904 mode fails shelf guard", () => {
    const fizeauItem = loadScenarios(defaultScenarioDirs()).find(
      (item) => item.scenario.id === "shelf-fizeau-fresnel-versus-relativistic",
    );
    if (!fizeauItem) {
      throw new Error("Missing shelf-fizeau-fresnel-versus-relativistic fixture.");
    }

    // Unit test: guard1904Shelf
    const modernCheck = guard1904Shelf(fizeauItem.scenario, false);
    expect(modernCheck.ok).toBe(true);

    const shelf1904Check = guard1904Shelf(fizeauItem.scenario, true);
    expect(shelf1904Check.ok).toBe(false);
    expect(shelf1904Check.reason).toBe(
      'Hypothesis "relativistic-drag-later" has historicalStatus "later-development" and cannot be cited in 1904 mode.',
    );

    // Runner integration: running under 1904 mode fails with shelf guard error
    const item1904 = {
      ...fizeauItem,
      raw: {
        ...fizeauItem.raw,
        mode: "1904",
      },
    };
    const res = runScenariosIsolated([item1904]).results[0];
    expect(res?.status).toBe("failed");
    expect(res?.message).toBe(
      'Hypothesis "relativistic-drag-later" has historicalStatus "later-development" and cannot be cited in 1904 mode.',
    );
  });

  test("AC 32: instrument non-value acceptance case requirement and rendered sentence leak guard", () => {
    // Part A: Instrument non-value acceptance case requirement
    const rawSr02 = strictParse(
      readFileSync(join(process.cwd(), "content/experiments/sr-02.yaml"), "utf8"),
      "yaml",
    ) as Record<string, unknown>;

    // When acceptanceCases is empty on an experiment allowing non-value output, validateExperiment throws
    expect(() =>
      validateExperiment({
        ...rawSr02,
        acceptanceCases: [],
      }),
    ).toThrow(ExperimentValidationError);

    // When acceptanceCases cites a discrimination scenario, validateExperiment passes
    const validated = validateExperiment({
      ...rawSr02,
      acceptanceCases: ["sr-02-emf-discriminates-at-0.6c"],
    });
    expect(validated.id).toBe("sr-02");
    expect(validated.acceptanceCases).toContain("sr-02-emf-discriminates-at-0.6c");

    // Part B: Rendered sentence leak guard
    const loaded = loadScenarios(defaultScenarioDirs()).filter((item) =>
      [
        "sr-02-emf-first-order-agreement",
        "sr-02-emf-discriminates-at-0.6c",
        "shelf-fizeau-fresnel-versus-relativistic",
      ].includes(item.scenario.id),
    );

    const forbiddenTerms = [
      "indistinguishable",
      "discriminates",
      "indeterminate",
      "discrimination",
      "passed",
      "failed",
    ];

    for (const item of loaded) {
      const scenario = item.scenario;
      const hypIds = (scenario.hypotheses ?? []).map((h) => h.id.toLowerCase());
      const allForbidden = [...forbiddenTerms, ...hypIds];

      const outcomes: Array<{
        outcome: "indistinguishable" | "discriminates" | "indeterminate";
        diff?: number;
      }> = [
        { outcome: "indistinguishable" },
        { outcome: "discriminates", diff: 1.25 },
        { outcome: "indeterminate" },
      ];

      for (const { outcome, diff } of outcomes) {
        const sentence = renderDiscriminationSentence(scenario, outcome, diff);
        expect(typeof sentence).toBe("string");
        expect(sentence.length).toBeGreaterThan(20);

        const lower = sentence.toLowerCase();
        for (const term of allForbidden) {
          expect(lower.includes(term.toLowerCase())).toBe(false);
        }
      }
    }
  });

  test("kind labels name the constant set and do not leak status ids in the sentence", () => {
    const sentence = scenarioKindLabel("discrimination", "modern-si-2019");
    expect(sentence.includes("modern-si-2019")).toBe(true);
    expect(sentence.includes("indistinguishable")).toBe(false);
    expect(sentence.includes("discriminates")).toBe(false);
  });
});
