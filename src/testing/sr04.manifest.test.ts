import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST_PATH = resolve(ROOT, "content/experiments/sr-04.yaml");

function loadRawManifest(): unknown {
  const yaml = readFileSync(MANIFEST_PATH, "utf8");
  return strictParse(yaml, "yaml");
}

describe("sr04.manifest: SR-04 manifest registration (am-sr-04-lorentz-map-px1k)", () => {
  test("the manifest validates against the real Experiment schema", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("sr-04");
  });

  test("notModeled is non-empty, and an empty list is rejected by the real validator", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.notModeled.length).toBeGreaterThan(0);

    const stripped = loadRawManifest() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow();
  });

  test("embeddable is true", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.embeddable).toBe(true);
  });

  test("predictMode is honestly exempt with a reason naming the real blocker", () => {
    const exp = validateExperiment(loadRawManifest());
    expect("exempt" in exp.predictMode && exp.predictMode.exempt).toBe(true);
    if ("exempt" in exp.predictMode) {
      expect(exp.predictMode.reason).toContain("am-inst-predict-mode-ti7m");
    }
  });

  test("no sr-04:1904 mode is declared in this pass (a real, named gap, not a silent omission)", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.modes ?? []).toEqual([]);
  });

  test("the three named presets parse under the preset grammar and name declared parameters", () => {
    const exp = validateExperiment(loadRawManifest());
    const declaredParamIds = new Set(exp.parameters.map((p) => p.id));
    const ids = exp.presets.map((p) => p.presetId).sort();
    expect(ids).toEqual(
      ["sr-04-galilean-shelf", "sr-04-construct-0.6c", "sr-04-later-aids-0.6c"].sort(),
    );
    for (const preset of exp.presets) {
      for (const paramId of Object.keys(preset.parameterValues)) {
        expect(declaredParamIds.has(paramId)).toBe(true);
      }
    }
  });

  test("live quantity ids bind to the real registry, never a legacy spelling", () => {
    const exp = validateExperiment(loadRawManifest());
    const ids = exp.parameters.map((p) => p.quantityId);
    expect(ids).toContain("frameSpeed");
    expect(ids).not.toContain("lightSpeed");
    expect(ids).not.toContain("observerSpeed");
  });
});
