import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST_PATH = resolve(ROOT, "content/experiments/lq-03.yaml");

function loadRawManifest(): unknown {
  const yaml = readFileSync(MANIFEST_PATH, "utf8");
  return strictParse(yaml, "yaml");
}

describe("lq03.manifest: LQ-03 manifest registration (am-lq-03-spectrum-08vz)", () => {
  test("the manifest validates against the real Experiment schema", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("lq-03");
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

  test("predictMode enables the authored questions, supported candidates and declared controls", () => {
    const exp = validateExperiment(loadRawManifest());
    if (!("enabled" in exp.predictMode)) throw new Error("This instrument must offer predictions.");
    expect(exp.predictMode.enabled).toBe(true);
    expect(
      exp.predictMode.prompts.map((prompt) => [
        prompt.promptId,
        prompt.supportedCandidateId,
        prompt.controlId,
      ]),
    ).toEqual([
      ["lq-03-predict-density-peak", "lq-03-predict-density-peak-different-frequency", "convention"],
      ["lq-03-predict-band-energy", "lq-03-predict-band-energy-same-energy", "coordinate"],
    ]);
  });

  test("the temperature parameter's domain matches the bead's stated teaching range", () => {
    const exp = validateExperiment(loadRawManifest());
    const T = exp.parameters.find((p) => p.id === "T");
    expect(T).toBeDefined();
    expect(T?.modelDomain.min).toBe(500);
    expect(T?.modelDomain.max).toBe(10000);
  });

  test("weavePredicates lists the two declared predicate ids", () => {
    const exp = validateExperiment(loadRawManifest());
    expect([...exp.weavePredicates].sort()).toEqual(
      ["lq03-s4-wien-confirmed-within-limits", "lq03-s2-classical-regime"].sort(),
    );
  });

  test("the acceptance case names the real committed scenario file", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.acceptanceCases).toContain("radiation-spectra-lq03");
    expect(exp.defaultScenario).toBe("radiation-spectra-lq03");
  });
});
