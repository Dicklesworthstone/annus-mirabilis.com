import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId, parsePresetId } from "../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = resolve(ROOT, "content/experiments/sr-03.yaml");

function loadRawManifest(): unknown {
  const yaml = readFileSync(MANIFEST_PATH, "utf8");
  return strictParse(yaml, "yaml");
}

describe("sr03.manifest: SR-03 manifest registration (am-sr-03-rod-simultaneity-0l5i)", () => {
  test("the manifest validates against the real Experiment schema", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("sr-03");
  });

  test("notModeled is non-empty, and an empty list is rejected by the validator", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.notModeled.length).toBeGreaterThan(0);

    const stripped = loadRawManifest() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });

  test("embeddable is true and realRate is false", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.embeddable).toBe(true);
    expect(exp.realRate.natural).toBe(false);
  });

  test("weavePredicates lists declared predicate ids for §2 and §4", () => {
    const exp = validateExperiment(loadRawManifest());
    expect([...exp.weavePredicates].sort()).toEqual(
      [
        "sr03-s2-simultaneity-relativity",
        "sr03-s4-rod-measurement",
        "sr03-s4-sphere-ellipsoid",
      ].sort(),
    );
  });

  test("both predict prompt ids parse under predict-prompt grammar and have at least 3 candidates", () => {
    const exp = validateExperiment(loadRawManifest());
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;
    expect(exp.predictMode.prompts.length).toBe(2);
    for (const prompt of exp.predictMode.prompts) {
      const parsed = parsePredictPromptId(prompt.promptId);
      expect(parsed.ok).toBe(true);
      expect(parsePresetId(prompt.promptId).ok).toBe(false);
      expect(prompt.candidates.length).toBeGreaterThanOrEqual(3);
    }
    const ids = exp.predictMode.prompts.map((p) => p.promptId).sort();
    expect(ids).toEqual(["sr-03-predict-causal-order", "sr-03-predict-endpoint-pair"].sort());
  });

  test("all presets parse under preset grammar and reference declared parameters", () => {
    const exp = validateExperiment(loadRawManifest());
    const declaredParamIds = new Set(exp.parameters.map((p) => p.id));
    expect(exp.presets.length).toBeGreaterThanOrEqual(5);
    for (const preset of exp.presets) {
      expect(parsePresetId(preset.presetId).ok).toBe(true);
      for (const paramId of Object.keys(preset.parameterValues)) {
        expect(declaredParamIds.has(paramId)).toBe(true);
      }
    }
  });

  test("outputs declare measuredLength and spacetimeIntervalSquared as primaries", () => {
    const exp = validateExperiment(loadRawManifest());
    const primaryOutputs = exp.outputs.filter((o) => o.primary).map((o) => o.id);
    expect(primaryOutputs).toContain("measuredLength");
    expect(primaryOutputs).toContain("spacetimeIntervalSquared");
  });
});
