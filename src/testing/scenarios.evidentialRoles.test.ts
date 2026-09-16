import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeclaredConstantSet } from "../physics/reference/constants.ts";
import {
  checkPrintedConsistency,
  guardIllustrativeInputs,
  historicalDerivedValueFlag,
  ILLUSTRATIVE_VALUE_AS_INPUT,
} from "./scenario-registry/evidentialRoleGuard.ts";
import { loadScenarioFile } from "./scenario-registry/load.ts";
import { runScenariosIsolated } from "./scenario-registry/run.ts";

const illustrative = createDeclaredConstantSet({
  id: "scenario-self-test-illustrative-direct",
  era: 1905,
  provenance: "Self-test.",
  precisionNote: "Self-test.",
  gasConstantProvenance: "measured-without-counting-molecules",
  entries: [
    {
      quantityId: "molarGasConstant",
      value: 8.31,
      exactDecimal: "8.31",
      unit: "J/(mol K)",
      kind: "declared-scenario",
      evidentialRole: "measured-observation",
      provenance: "R",
      dependsOn: [],
      uncertainty: 0.005,
    },
    {
      quantityId: "avogadroConstant",
      value: 6e23,
      exactDecimal: "6e23",
      unit: "1/mol",
      kind: "declared-scenario",
      evidentialRole: "measured-observation",
      provenance: "N",
      dependsOn: [],
      uncertainty: 1e22,
    },
    {
      quantityId: "rmsDisplacement1d",
      value: 7.947833e-7,
      exactDecimal: "7.947833e-7",
      unit: "m",
      kind: "declared-scenario",
      evidentialRole: "illustrative-computation",
      provenance: "printed 0,8 Mikron is an output",
      dependsOn: ["temperature", "viscosity", "particleRadius"],
    },
  ],
});

describe("evidential roles", () => {
  test("reading the printed displacement as an input is refused", () => {
    const refusal = guardIllustrativeInputs(
      ["rmsDisplacement1d"],
      illustrative,
      "self-test-illustrative-input",
      "temperature, viscosity, radius",
    );
    expect(refusal?.code).toBe(ILLUSTRATIVE_VALUE_AS_INPUT);
    expect(refusal?.message.includes("self-test-illustrative-input")).toBe(true);
    expect(refusal?.message.includes("rmsDisplacement1d")).toBe(true);
  });

  test("comparing against the illustrative entry as expected still recomputes from dependsOn", () => {
    const rows = checkPrintedConsistency(illustrative, {
      T: 290.15,
      eta: 0.00135,
      a: 0.5e-6,
      t: 1,
    });
    expect(rows.length).toBe(1);
    const actual = rows[0]?.actual ?? Number.NaN;
    expect(Math.abs(actual / 0.7947833e-6 - 1)).toBeLessThan(1e-6);
  });

  test("a theoretical-estimate consumed in historical mode is a flag, not a refusal", () => {
    const set = createDeclaredConstantSet({
      id: "scenario-flag-theoretical",
      era: 1905,
      provenance: "Self-test.",
      precisionNote: "Self-test.",
      gasConstantProvenance: "measured-without-counting-molecules",
      entries: [
        {
          quantityId: "avogadroNumberEstimate",
          value: 6e23,
          exactDecimal: "6e23",
          unit: "1/mol",
          kind: "declared-scenario",
          evidentialRole: "theoretical-estimate",
          provenance: "estimate",
          dependsOn: ["molarGasConstant"],
          uncertainty: 1e22,
        },
      ],
    });
    const flag = historicalDerivedValueFlag(["avogadroNumberEstimate"], set, true);
    expect(flag?.flag).toBe("historical-inference-uses-derived-value");
    const asInput = guardIllustrativeInputs(["avogadroNumberEstimate"], set, "x", "y");
    expect(asInput).toBeNull();
  });

  test("a scenario whose inputs name the illustrative displacement fails the runner", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, "scenario-fixtures/negatives/illustrative-input.yaml");
    const { results } = runScenariosIsolated([loadScenarioFile(path)]);
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.message.includes("illustrative-value-as-input")).toBe(true);
  });
});
