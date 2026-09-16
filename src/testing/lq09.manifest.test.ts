import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../content/provenance/yaml.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";

describe("LQ-09 Experiment Manifest (am-lq-09-ionization-mbul)", () => {
  const manifestPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../content/experiments/lq-09.yaml",
  );
  const rawText = readFileSync(manifestPath, "utf-8");
  const rawYaml = parseYaml(rawText);

  it("validates strictly against the canonical Experiment schema", () => {
    const experiment = validateExperiment(rawYaml, "lq-09");
    expect(experiment.id).toBe("lq-09");
    expect(experiment.title).toContain("Gas Ionization");
    expect(experiment.schemaVersion).toBe(1);
  });

  it("declares non-empty notModeled limitations (epistemic integrity)", () => {
    const experiment = validateExperiment(rawYaml, "lq-09");
    expect(Array.isArray(experiment.notModeled)).toBe(true);
    expect(experiment.notModeled.length).toBeGreaterThanOrEqual(3);
  });

  it("declares all required parameters with correct command classes", () => {
    const experiment = validateExperiment(rawYaml, "lq-09");
    const paramIds = experiment.parameters.map((p) => p.id);
    expect(paramIds).toContain("frequency");
    expect(paramIds).toContain("ionizationEnergyEv");
    expect(paramIds).toContain("incidentPower");
    expect(paramIds).toContain("absorptionEfficiency");
    expect(paramIds).toContain("duration");
    expect(paramIds).toContain("declaredFraction");
  });

  it("declares required outputs including threshold and ionization rate", () => {
    const experiment = validateExperiment(rawYaml, "lq-09");
    const outputIds = experiment.outputs.map((o) => o.id);
    expect(outputIds).toContain("quantumEnergy");
    expect(outputIds).toContain("thresholdFrequency");
    expect(outputIds).toContain("excessEnergyEv");
    expect(outputIds).toContain("absorbedLightEnergy");
    expect(outputIds).toContain("quantumRate");
    expect(outputIds).toContain("absorbedQuantumRate");
    expect(outputIds).toContain("ionizationRate");
    expect(outputIds).toContain("ionizationCount");
    expect(outputIds).toContain("ionizedGramMolecules");
    expect(outputIds).toContain("singleQuantumAllowed");
  });

  it("registers canonical presets", () => {
    const experiment = validateExperiment(rawYaml, "lq-09");
    const presetIds = experiment.presets.map((p) => p.presetId);
    expect(presetIds).toContain("lq-09-threshold");
    expect(presetIds).toContain("lq-09-sub-threshold");
    expect(presetIds).toContain("lq-09-historical-checks");
  });
});
