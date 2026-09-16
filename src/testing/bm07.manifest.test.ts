import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId, parsePresetId } from "../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { isValidTapeId, validateControlTape } from "../experiments/tapes/schema.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadRawManifest(): unknown {
  return strictParse(readFileSync(resolve(ROOT, "content/experiments/bm-07.yaml"), "utf8"), "yaml");
}

describe("bm07.manifest: BM-07 instrument contract (am-bm-07-infer-molecular-number-frf9)", () => {
  test("the manifest validates and a reader route exists at /lab/bm-07/", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("bm-07");
    expect(exp.notModeled.length).toBeGreaterThan(0);
    expect(exp.embeddable).toBe(true);
    expect(exp.views.some((v) => v.kind === "table")).toBe(true);
    expect(exp.actions.length).toBeGreaterThan(0);
    expect(exp.actions[0]?.family).toBe("probability-diffusion");
    expect(readFileSync(resolve(ROOT, "src/app/lab/bm-07/page.tsx"), "utf8")).toContain(
      "InferenceComparison",
    );
  });

  test("four presets parse as presets and never as mode addresses", () => {
    const exp = validateExperiment(loadRawManifest());
    const ids = exp.presets.map((p) => p.presetId).sort();
    expect(ids).toEqual(
      [
        "bm-07-coverage",
        "bm-07-identifiability",
        "bm-07-inversion-golden",
        "bm-07-perrin-1909",
      ].sort(),
    );
    for (const preset of exp.presets) {
      expect(parsePresetId(preset.presetId).ok).toBe(true);
      expect(preset.presetId.includes(":")).toBe(false);
    }
    expect(parsePresetId("bm-07:identifiability").ok).toBe(false);
    expect(exp.modes).toBeUndefined();
  });

  test("a fixture consumer citing bm-07-velocity-trap fails as a dangling id", () => {
    const exp = validateExperiment(loadRawManifest());
    const registered = new Set(exp.presets.map((p) => p.presetId));
    expect(registered.has("bm-07-velocity-trap")).toBe(false);
    expect([...registered].sort().join(",")).toContain("bm-07-identifiability");
  });

  test("teaching tape perrins-count loads; perrin-count and bm-07:perrins-count fail the tape-id check", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.teachingTapes.some((t) => t.tapeId === "perrins-count")).toBe(true);
    const tape = validateControlTape(
      strictParse(
        readFileSync(resolve(ROOT, "content/experiments/tapes/perrins-count.yaml"), "utf8"),
        "yaml",
      ),
    );
    expect(tape.tapeId).toBe("perrins-count");
    expect(tape.experimentId).toBe("bm-07");
    expect(tape.constantSetId).toBe("scenario-gas-constant-measured");
    expect(tape.constantSetId).not.toBe("modern-si-2019");
    expect(isValidTapeId("perrins-count")).toBe(true);
    expect(isValidTapeId("bm-07:perrins-count")).toBe(false);
    expect(tape.tapeId).not.toBe("perrin-count");
  });

  test("predict prompt has three candidates and empty notModeled is rejected", () => {
    const exp = validateExperiment(loadRawManifest());
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;
    expect(exp.predictMode.prompts[0]?.promptId).toBe("bm-07-predict-sample-size");
    expect(parsePredictPromptId("bm-07-predict-sample-size").ok).toBe(true);
    expect(exp.predictMode.prompts[0]?.candidates.length).toBe(3);
    const stripped = loadRawManifest() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });
});
