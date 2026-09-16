import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../content/provenance/yaml.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";

describe("LQ-08 Predict-Mode Prompts (am-lq-08-photoelectric-va5a)", () => {
  const manifestPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../content/experiments/lq-08.yaml",
  );
  const rawText = readFileSync(manifestPath, "utf-8");
  const rawYaml = parseYaml(rawText);
  const experiment = validateExperiment(rawYaml, "lq-08");

  it("has predictMode enabled with 3 distinct prompts", () => {
    expect("enabled" in experiment.predictMode && experiment.predictMode.enabled).toBe(true);
    if ("enabled" in experiment.predictMode && experiment.predictMode.enabled) {
      expect(experiment.predictMode.prompts.length).toBe(3);
    }
  });

  it("Prompt 1 (lq-08-predict-double-power): on incidentPower with correct candidate options", () => {
    if (!("enabled" in experiment.predictMode)) return;
    const prompt = experiment.predictMode.prompts.find(
      (p) => p.promptId === "lq-08-predict-double-power",
    );
    expect(prompt).toBeDefined();
    expect(prompt?.controlId).toBe("incidentPower");
    expect(prompt?.candidates.length).toBe(3);

    const candIds = prompt?.candidates.map((c) => c.id);
    expect(candIds).toContain("lq-08-predict-double-power-increases");
    expect(candIds).toContain("lq-08-predict-double-power-unchanged");
    expect(candIds).toContain("lq-08-predict-double-power-decreases");

    const unchangedCand = prompt?.candidates.find(
      (c) => c.id === "lq-08-predict-double-power-unchanged",
    );
    expect(unchangedCand?.separatingAssumption).toContain("Light-quantum assumption");
  });

  it("Prompt 2 (lq-08-predict-raise-frequency): on frequency with correct candidate options", () => {
    if (!("enabled" in experiment.predictMode)) return;
    const prompt = experiment.predictMode.prompts.find(
      (p) => p.promptId === "lq-08-predict-raise-frequency",
    );
    expect(prompt).toBeDefined();
    expect(prompt?.controlId).toBe("frequency");
    expect(prompt?.candidates.length).toBe(3);

    const candIds = prompt?.candidates.map((c) => c.id);
    expect(candIds).toContain("lq-08-predict-raise-frequency-rate-rises");
    expect(candIds).toContain("lq-08-predict-raise-frequency-rate-falls");
    expect(candIds).toContain("lq-08-predict-raise-frequency-rate-unchanged");

    const fallsCand = prompt?.candidates.find(
      (c) => c.id === "lq-08-predict-raise-frequency-rate-falls",
    );
    expect(fallsCand?.separatingAssumption).toContain("Light-quantum accounting");
  });

  it("Prompt 3 (lq-08-predict-two-metals): on workFunction with correct candidate options", () => {
    if (!("enabled" in experiment.predictMode)) return;
    const prompt = experiment.predictMode.prompts.find(
      (p) => p.promptId === "lq-08-predict-two-metals",
    );
    expect(prompt).toBeDefined();
    expect(prompt?.controlId).toBe("workFunction");
    expect(prompt?.candidates.length).toBe(3);

    const candIds = prompt?.candidates.map((c) => c.id);
    expect(candIds).toContain("lq-08-predict-two-metals-parallel");
    expect(candIds).toContain("lq-08-predict-two-metals-crossing");
    expect(candIds).toContain("lq-08-predict-two-metals-identical");

    const parallelCand = prompt?.candidates.find(
      (c) => c.id === "lq-08-predict-two-metals-parallel",
    );
    expect(parallelCand?.separatingAssumption).toContain("Universal quantum slope");
  });
});
