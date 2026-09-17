import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../content/provenance/yaml.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";

describe("LQ-08 Experiment Manifest (am-lq-08-photoelectric-va5a)", () => {
  const manifestPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../content/experiments/lq-08.yaml",
  );
  const rawText = readFileSync(manifestPath, "utf-8");
  const rawYaml = parseYaml(rawText);

  it("validates strictly against the canonical Experiment schema", () => {
    const experiment = validateExperiment(rawYaml, "lq-08");
    expect(experiment.id).toBe("lq-08");
    expect(experiment.title).toContain("Photoelectric");
    expect(experiment.schemaVersion).toBe(1);
    expect(experiment.explanatoryQuestion).toBe(
      "What changes the energy of the emitted electrons, and what changes their number?",
    );
  });

  it("declares exact notModeled limitations from bead specification", () => {
    const experiment = validateExperiment(rawYaml, "lq-08");
    const expectedNotModeled = [
      "Real-material electron energy distributions and yields",
      "Contact potentials and surface states",
      "Space charge",
      "Reflection losses",
      "Emission angles",
      "Multi-photon or thermionic emission",
      "The timing of individual emissions",
      "Energy transfer models beyond the declared complete or partial cases",
      "Any claim that the moving marks depict photons",
    ];
    expect(experiment.notModeled).toEqual(expectedNotModeled);
  });

  it("declares tapeModel as lq-08@1", () => {
    const experiment = validateExperiment(rawYaml, "lq-08");
    expect(experiment.tapeModel?.modelId).toBe("lq-08");
    expect(experiment.tapeModel?.modelVersion).toBe(1);
    expect(`${experiment.tapeModel?.modelId}@${experiment.tapeModel?.modelVersion}`).toBe(
      "lq-08@1",
    );
  });

  it("declares all required parameters with correct command classes", () => {
    const experiment = validateExperiment(rawYaml, "lq-08");
    const paramIds = experiment.parameters.map((p) => p.id);
    expect(paramIds).toContain("incidentPower");
    expect(paramIds).toContain("frequency");
    expect(paramIds).toContain("workFunction");
    expect(paramIds).toContain("quantumEfficiency");
    expect(paramIds).toContain("collectorPotential");
  });

  it("declares required outputs including stopping potential and photocurrent", () => {
    const experiment = validateExperiment(rawYaml, "lq-08");
    const outputIds = experiment.outputs.map((o) => o.id);
    expect(outputIds).toContain("quantumEnergy");
    expect(outputIds).toContain("thresholdFrequency");
    expect(outputIds).toContain("maxKineticEnergy");
    expect(outputIds).toContain("stoppingPotentialMagnitude");
    expect(outputIds).toContain("quantumRate");
    expect(outputIds).toContain("emissionRate");
    expect(outputIds).toContain("photocurrent");
  });

  it("registers 3 canonical presets", () => {
    const experiment = validateExperiment(rawYaml, "lq-08");
    const presetIds = experiment.presets.map((p) => p.presetId);
    expect(presetIds).toContain("lq-08-intensity-probe");
    expect(presetIds).toContain("lq-08-historical-check");
    expect(presetIds).toContain("lq-08-two-metals");
  });
});
