import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId, parsePresetId } from "../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = resolve(ROOT, "content/experiments/bm-04.yaml");

function loadRawManifest(): unknown {
  const yaml = readFileSync(MANIFEST_PATH, "utf8");
  return strictParse(yaml, "yaml");
}

describe("bm04.manifest: BM-04 manifest registration (am-bm-04-drift-diffusion-balance-fpow)", () => {
  test("the manifest validates against the real Experiment schema", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("bm-04");
  });

  test("notModeled is non-empty, and an empty list is rejected by the real validator", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.notModeled.length).toBeGreaterThan(0);

    const stripped = loadRawManifest() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });

  test("embeddable is true", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.embeddable).toBe(true);
  });

  test("weavePredicates lists the declared predicate ids", () => {
    const exp = validateExperiment(loadRawManifest());
    expect([...exp.weavePredicates].sort()).toEqual(
      ["bm04-s3-diffusion-coefficient", "bm04-s3-force-balance"].sort(),
    );
  });

  test("both predict prompt ids parse under the predict-prompt grammar and neither parses as a preset", () => {
    const exp = validateExperiment(loadRawManifest());
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;
    expect(exp.predictMode.prompts.length).toBe(2);
    for (const prompt of exp.predictMode.prompts) {
      const parsed = parsePredictPromptId(prompt.promptId);
      expect(parsed.ok).toBe(true);
      expect(parsePresetId(prompt.promptId).ok).toBe(false);
      expect(prompt.candidates.length).toBe(3);
    }
  });

  test("every preset id parses under the preset grammar and none parses as a predict prompt", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.presets.length).toBeGreaterThanOrEqual(4);
    const declaredParamIds = new Set(exp.parameters.map((p) => p.id));
    for (const preset of exp.presets) {
      expect(parsePresetId(preset.presetId).ok).toBe(true);
      expect(parsePredictPromptId(preset.presetId).ok).toBe(false);
      for (const paramId of Object.keys(preset.parameterValues)) {
        expect(declaredParamIds.has(paramId)).toBe(true);
      }
    }
  });

  test("trace rows reference declared quantities in owner", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.owner.kind).toBe("reference-evaluator");
    if (exp.owner.kind === "reference-evaluator" && exp.owner.traceRows) {
      expect(exp.owner.traceRows.length).toBeGreaterThan(0);
      for (const row of exp.owner.traceRows) {
        expect(typeof row.quantityId).toBe("string");
        expect(typeof row.value).toBe("number");
      }
    }
  });
});
