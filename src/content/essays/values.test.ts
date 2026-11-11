import { describe, expect, test } from "bun:test";
import type { EssayQuotedValue } from "../schemas/essay.ts";
import type { Scenario } from "../schemas/experiment.ts";
import { checkEssayValueFormatting, checkScenarioOutput } from "./values.ts";

const scenario: Scenario = {
  id: "essay-numerical-check", kind: "modern-golden", title: "Numeric comparison",
  description: "A planted mismatch remains visible before display rounding.",
  constantSetId: "modern-si-2019", owner: "test-owner", inputs: {},
  expected: { outputs: [{ outputId: "value", value: 1, comparisonKind: "tolerance",
    tolerance: { relative: 1e-12 } }] },
  modelVersion: 1, schemaVersion: 1,
};
const quote: EssayQuotedValue = {
  id: "sample", scenarioId: scenario.id, outputId: "value", source: "output",
  displayedAs: "1.00", significantFigures: 3, notation: "standard", scale: 1, unit: "",
};

describe("essay numerical provenance", () => {
  test("equal displayed strings cannot hide an owner mismatch", () => {
    expect(checkEssayValueFormatting(quote, 1, "case")).toBe("1.00");
    expect(checkEssayValueFormatting(quote, 1.00001, "case")).toBe("1.00");
    expect(() => checkScenarioOutput(scenario, { value: 1.00001 }, "value", "case"))
      .toThrow("before formatting");
    expect(checkScenarioOutput(scenario, { value: 1 }, "value", "case")).toBe(1);
  });

  test("formatting drift fails independently of a correct numeric result", () => {
    const value = checkScenarioOutput(scenario, { value: 1 }, "value", "case");
    expect(() => checkEssayValueFormatting({ ...quote, displayedAs: "1.0" }, value, "case"))
      .toThrow("shared formatter");
  });

  test("a finite model value cannot overflow while scaling or taking a ratio", () => {
    expect(() => checkEssayValueFormatting(
      { ...quote, scale: 1e308, displayedAs: "Infinity" }, 2, "case",
    )).toThrow("not finite");
    expect(() => checkEssayValueFormatting(
      { ...quote, displayedAs: "Infinity" }, Infinity, "case",
    )).toThrow("not finite");
  });

  test("missing outputs and nonfinite results cannot become quoted numbers", () => {
    expect(() => checkScenarioOutput(scenario, {}, "value", "case")).toThrow("finite golden");
    expect(() => checkScenarioOutput(scenario, { value: Number.NaN }, "value", "case"))
      .toThrow("finite golden");
  });
});
