import { describe, expect, test } from "bun:test";
import { validateScenario } from "../../content/schemas/experiment.ts";
import {
  conductorFrameEmf,
  fresnelDraggedIncrement,
  magnetFrameEmf,
  relativisticDraggedIncrement,
} from "../scenario-fixtures/evaluator.ts";
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
        expected: { outcome: "indistinguishable" },
        modelVersion: 1,
        schemaVersion: 1,
      }),
    ).toThrow();
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
        expected: { outcome: "indistinguishable", residual: 1.767e-8 },
        modelVersion: 1,
        schemaVersion: 1,
      }),
    ).toThrow();
  });

  test("kind labels name the constant set and do not leak status ids in the sentence", () => {
    const sentence = scenarioKindLabel("discrimination", "modern-si-2019");
    expect(sentence.includes("modern-si-2019")).toBe(true);
    expect(sentence.includes("indistinguishable")).toBe(false);
    expect(sentence.includes("discriminates")).toBe(false);
  });
});
