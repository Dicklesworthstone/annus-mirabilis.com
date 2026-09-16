import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId, parsePresetId } from "../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { evaluateSr06 } from "../experiments/sr06/session.ts";
import { SR06_DEFAULTS } from "../experiments/sr06/definition.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadRaw(): unknown {
  return strictParse(readFileSync(resolve(ROOT, "content/experiments/sr-06.yaml"), "utf8"), "yaml");
}

describe("sr-06 manifest prompts and presets", () => {
  test("predict prompt sr-06-predict-collinear has the three candidate ids", () => {
    const exp = validateExperiment(loadRaw());
    expect(exp.id).toBe("sr-06");
    expect(exp.embeddable).toBe(true);
    expect(exp.notModeled.length).toBeGreaterThan(0);
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;
    const prompt = exp.predictMode.prompts.find((p) => p.promptId === "sr-06-predict-collinear");
    expect(prompt).toBeDefined();
    expect(parsePredictPromptId("sr-06-predict-collinear").ok).toBe(true);
    expect(parsePredictPromptId("sr-06:predict-collinear").ok).toBe(false);
    expect(prompt?.controlId).toBe("movingSpeed");
    expect(prompt?.candidates.map((c) => c.id).sort()).toEqual(
      ["galilean-sum", "relativistic-15-17", "unchanged-0-6c"].sort(),
    );
    const out = evaluateSr06(SR06_DEFAULTS);
    const U = out.find((r) => r.quantityId === "composedSpeedOverC");
    expect(U?.status).toBe("value");
    if (U?.status === "value" && typeof U.value === "number") {
      expect(U.value).toBeCloseTo(15 / 17, 12);
      expect(1.2).not.toBeCloseTo(U.value, 2);
      expect(0.6).not.toBeCloseTo(U.value, 2);
    }
  });

  test("presets parse; colon form is rejected; empty notModeled fails", () => {
    const exp = validateExperiment(loadRaw());
    const ids = exp.presets.map((p) => p.presetId);
    expect(ids).toContain("sr-06-collinear-0.6-0.6");
    for (const id of ids) expect(parsePresetId(id).ok).toBe(true);
    expect(parsePresetId("sr-06:collinear-0.6-0.6").ok).toBe(false);
    const stripped = loadRaw() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });
});
