import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId, parsePresetId } from "../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = resolve(ROOT, "content/experiments/lq-01.yaml");

function loadRawManifest(): unknown {
  const yaml = readFileSync(MANIFEST_PATH, "utf8");
  return strictParse(yaml, "yaml");
}

describe("lq01.manifest: LQ-01 manifest validation and predict prompts (am-lq-01-wave-description-kv2r)", () => {
  test("the manifest validates against the real Experiment schema", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("lq-01");
  });

  test("notModeled is non-empty, and an empty list is rejected by the real validator", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.notModeled.length).toBeGreaterThan(0);

    const stripped = loadRawManifest() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });

  test("weavePredicates lists the declared predicate ids", () => {
    const exp = validateExperiment(loadRawManifest());
    expect([...exp.weavePredicates].sort()).toEqual(
      ["lq01-s0-wave-success", "lq01-s0-time-averages", "lq01-s0-energy-spreading"].sort(),
    );
  });

  test("both predict prompt ids parse under predict-prompt grammar and name unique controls", () => {
    const exp = validateExperiment(loadRawManifest());
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;

    expect(exp.predictMode.prompts.length).toBe(2);
    const controls = new Set<string>();

    for (const prompt of exp.predictMode.prompts) {
      const parsed = parsePredictPromptId(prompt.promptId);
      expect(parsed.ok).toBe(true);
      expect(parsePresetId(prompt.promptId).ok).toBe(false);
      expect(prompt.candidates.length).toBe(3);

      if (prompt.controlId) {
        expect(controls.has(prompt.controlId)).toBe(false);
        controls.add(prompt.controlId);
      }

      // Check candidate ids unique within prompt
      const candIds = new Set(prompt.candidates.map((c) => c.id));
      expect(candIds.size).toBe(3);
    }
  });

  test("lq-01-predict-phase-shift has candidates unchanged, halves, drops-to-zero", () => {
    const exp = validateExperiment(loadRawManifest());
    if (!("enabled" in exp.predictMode)) return;
    const prompt = exp.predictMode.prompts.find((p) => p.promptId === "lq-01-predict-phase-shift");
    expect(prompt).toBeDefined();
    expect(prompt?.candidates.map((c) => c.id)).toEqual(["unchanged", "halves", "drops-to-zero"]);
  });

  test("lq-01-predict-inverse-square has candidates halves, quarters, unchanged", () => {
    const exp = validateExperiment(loadRawManifest());
    if (!("enabled" in exp.predictMode)) return;
    const prompt = exp.predictMode.prompts.find(
      (p) => p.promptId === "lq-01-predict-inverse-square",
    );
    expect(prompt).toBeDefined();
    expect(prompt?.candidates.map((c) => c.id)).toEqual(["halves", "quarters", "unchanged"]);
  });

  test("every preset id parses under preset grammar and none parses as predict prompt", () => {
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

  test("lq-01-equal-amplitudes preset is declared with A1=1, A2=1, delta=0", () => {
    const exp = validateExperiment(loadRawManifest());
    const equalPreset = exp.presets.find((p) => p.presetId === "lq-01-equal-amplitudes");
    expect(equalPreset).toBeDefined();
    expect(equalPreset?.parameterValues.A1).toBe(1);
    expect(equalPreset?.parameterValues.A2).toBe(1);
    expect(equalPreset?.parameterValues.delta).toBe(0);
  });
});
