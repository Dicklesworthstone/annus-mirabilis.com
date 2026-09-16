import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId, parsePresetId } from "../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { SR07_DEFAULTS } from "../experiments/sr07/definition.ts";
import { evaluateSr07 } from "../experiments/sr07/session.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadRaw(): unknown {
  return strictParse(readFileSync(resolve(ROOT, "content/experiments/sr-07.yaml"), "utf8"), "yaml");
}

describe("sr-07 manifest prompts and presets", () => {
  test("predict prompt sr-07-predict-n-combination has the three candidate ids", () => {
    const exp = validateExperiment(loadRaw());
    expect(exp.id).toBe("sr-07");
    expect(exp.embeddable).toBe(true);
    expect(exp.notModeled.length).toBeGreaterThan(0);
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;
    const prompt = exp.predictMode.prompts.find(
      (p) => p.promptId === "sr-07-predict-n-combination",
    );
    expect(prompt).toBeDefined();
    expect(parsePredictPromptId("sr-07-predict-n-combination").ok).toBe(true);
    expect(parsePredictPromptId("sr-07:predict-n-combination").ok).toBe(false);
    expect(prompt?.controlId).toBe("stepIndex");
    expect(prompt?.candidates.map((c) => c.id).sort()).toEqual(
      ["N", "N-minus-vY", "beta-N-minus"].sort(),
    );
    const out = evaluateSr07(SR07_DEFAULTS);
    const flag = out.find((r) => r.quantityId === "formInvariant");
    expect(flag?.status).toBe("value");
    if (flag?.status === "value" && typeof flag.value === "number") expect(flag.value).toBe(1);
  });

  test("presets parse; colon form is rejected; empty notModeled fails", () => {
    const exp = validateExperiment(loadRaw());
    const ids = exp.presets.map((p) => p.presetId);
    expect(ids).toContain("sr-07-plane-wave-0.6c");
    expect(ids).toContain("sr-07-oblique-wave-0.6c");
    expect(ids).toContain("sr-07-equation-1-grouping");
    for (const id of ids) expect(parsePresetId(id).ok).toBe(true);
    expect(parsePresetId("sr-07:plane-wave-0.6c").ok).toBe(false);
    const stripped = loadRaw() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });
});
