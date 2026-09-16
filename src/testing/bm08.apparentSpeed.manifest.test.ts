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
  return strictParse(readFileSync(resolve(ROOT, "content/experiments/bm-08.yaml"), "utf8"), "yaml");
}

describe("bm08.apparentSpeed.manifest: BM-08 instrument contract and apparent speed (am-bm-08-measurement-bias-h1ye)", () => {
  test("the manifest validates and a reader route exists at /lab/bm-08/", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("bm-08");
    expect(exp.notModeled.length).toBeGreaterThanOrEqual(3);
    expect(exp.embeddable).toBe(true);
    expect(exp.views.some((v) => v.kind === "table")).toBe(true);
    expect(exp.actions.length).toBeGreaterThan(0);
    expect(exp.actions[0]?.family).toBe("probability-diffusion");
    expect(readFileSync(resolve(ROOT, "src/app/lab/bm-08/page.tsx"), "utf8")).toContain(
      "CameraComparison",
    );
  });

  test("preset bm-08-apparent-speed-noise parses as preset and not as mode", () => {
    const exp = validateExperiment(loadRawManifest());
    const apparentSpeedPreset = exp.presets.find(
      (p) => p.presetId === "bm-08-apparent-speed-noise",
    );
    expect(apparentSpeedPreset).toBeDefined();
    expect(parsePresetId("bm-08-apparent-speed-noise").ok).toBe(true);
    if (!apparentSpeedPreset) throw new Error("Expected apparent speed preset");
    expect(apparentSpeedPreset.presetId.includes(":")).toBe(false);
    expect(parsePresetId("bm-08:apparent-speed-noise").ok).toBe(false);
    expect(exp.modes).toBeUndefined();
  });

  test("all registered presets parse strictly without mode colons", () => {
    const exp = validateExperiment(loadRawManifest());
    const expectedPresetIds = [
      "bm-08-apparent-speed-noise",
      "bm-08-noise-only",
      "bm-08-exposure-fixture",
      "bm-08-drift-fluid",
      "bm-08-drift-stage",
      "bm-08-cve",
      "bm-08-pairs-exact-coverage",
      "bm-08-pairs-estimated-coverage",
      "bm-08-overlap-refusal",
    ];
    const registeredIds = exp.presets.map((p) => p.presetId);
    for (const id of expectedPresetIds) {
      expect(registeredIds).toContain(id);
      expect(parsePresetId(id).ok).toBe(true);
    }
  });

  test("teaching tape camera-bias loads and validates", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.teachingTapes.some((t) => t.tapeId === "camera-bias")).toBe(true);
    const tape = validateControlTape(
      strictParse(
        readFileSync(resolve(ROOT, "content/experiments/tapes/camera-bias.yaml"), "utf8"),
        "yaml",
      ),
    );
    expect(tape.tapeId).toBe("camera-bias");
    expect(tape.experimentId).toBe("bm-08");
    expect(isValidTapeId("camera-bias")).toBe(true);
    expect(isValidTapeId("bm-08:camera-bias")).toBe(false);
  });

  test("predict prompt has three candidates and empty notModeled is rejected", () => {
    const exp = validateExperiment(loadRawManifest());
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;
    expect(exp.predictMode.prompts[0]?.promptId).toBe("bm-08-predict-camera-noise");
    expect(parsePredictPromptId("bm-08-predict-camera-noise").ok).toBe(true);
    expect(exp.predictMode.prompts[0]?.candidates.length).toBe(3);

    const stripped = loadRawManifest() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });

  test("readings-owners file exists with R0-R3 for bm-08 and presets", () => {
    const ownersRaw = strictParse(
      readFileSync(
        resolve(ROOT, "content/editorial/readings-owners/am-bm-08-measurement-bias-h1ye.yaml"),
        "utf8",
      ),
      "yaml",
    ) as { beadId?: string; targets?: Array<{ id: string; readings: Record<string, string> }> };

    expect(ownersRaw.beadId).toBe("am-bm-08-measurement-bias-h1ye");
    expect(Array.isArray(ownersRaw.targets)).toBe(true);

    const bm08Target = ownersRaw.targets?.find((t) => t.id === "bm-08");
    expect(bm08Target).toBeDefined();
    expect(bm08Target?.readings.r0).toBeDefined();
    expect(bm08Target?.readings.r1).toBeDefined();
    expect(bm08Target?.readings.r2).toBeDefined();
    expect(bm08Target?.readings.r3).toBeDefined();

    const speedTarget = ownersRaw.targets?.find((t) => t.id === "bm-08-apparent-speed-noise");
    expect(speedTarget).toBeDefined();
    expect(speedTarget?.readings.r0).toBeDefined();
    expect(speedTarget?.readings.r1).toBeDefined();
    expect(speedTarget?.readings.r2).toBeDefined();
    expect(speedTarget?.readings.r3).toBeDefined();
  });
});
