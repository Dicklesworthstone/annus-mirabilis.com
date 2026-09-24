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
    expect(candIds).toEqual(["energy-increases", "energy-unchanged", "energy-decreases"]);

    // The model's answer, and its note gives the model's reason: one quantum, of energy hν, to one
    // electron. (Until 840cae6d this pinned the note's old label, "Light-quantum assumption".)
    expect(prompt?.supportedCandidateId).toBe("energy-unchanged");
    const unchangedCand = prompt?.candidates.find((c) => c.id === "energy-unchanged");
    for (const term of ["one quantum", "hν", "one electron"])
      expect(unchangedCand?.separatingAssumption).toContain(term);
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
    expect(candIds).toEqual(["rate-rises", "rate-falls", "rate-unchanged"]);

    // The model's answer, and its reason: the power is the number of quanta times hν.
    // (Until 840cae6d this pinned the note's old label, "Light-quantum accounting".)
    expect(prompt?.supportedCandidateId).toBe("rate-falls");
    const fallsCand = prompt?.candidates.find((c) => c.id === "rate-falls");
    for (const term of ["number of quanta", "times hν", "fewer"])
      expect(fallsCand?.separatingAssumption).toContain(term);
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
    expect(candIds).toEqual(["lines-parallel", "lines-crossing", "lines-identical"]);

    // The model's answer, and its reason: the slope is h/e, with nothing about the metal in it.
    // (Until 840cae6d this pinned the note's old label, "Universal quantum slope".)
    expect(prompt?.supportedCandidateId).toBe("lines-parallel");
    const parallelCand = prompt?.candidates.find((c) => c.id === "lines-parallel");
    for (const term of ["h/e", "nothing about the metal", "work function"])
      expect(parallelCand?.separatingAssumption).toContain(term);
  });

  it("symbolScan: questions, labels, and descriptions are completely free of mathematical symbols", () => {
    if (!("enabled" in experiment.predictMode)) return;
    const symbolPattern = /[$\\{}^_*/=<>]|\b(nu|phi|beta|hnu|hbar)\b/i;

    for (const prompt of experiment.predictMode.prompts) {
      expect(symbolPattern.test(prompt.question)).toBe(false);
      for (const cand of prompt.candidates) {
        expect(symbolPattern.test(cand.label)).toBe(false);
        expect(symbolPattern.test(cand.description)).toBe(false);
      }
    }
  });

  it("Negative validations: 2 candidates, duplicated id, or invalid id fails manifest schema", () => {
    const baseYaml = JSON.parse(JSON.stringify(rawYaml));
    const prompts = baseYaml.predictMode.prompts;

    // 2 candidates
    const twoCandYaml = JSON.parse(JSON.stringify(baseYaml));
    twoCandYaml.predictMode.prompts[0].candidates.pop();
    expect(() => validateExperiment(twoCandYaml, "lq-08")).toThrow();

    // duplicated candidate id
    const dupCandYaml = JSON.parse(JSON.stringify(baseYaml));
    dupCandYaml.predictMode.prompts[0].candidates[1].id = "energy-increases";
    expect(() => validateExperiment(dupCandYaml, "lq-08")).toThrow();

    // prompt missing controlId and actionId
    const missingTargetYaml = JSON.parse(JSON.stringify(baseYaml));
    delete missingTargetYaml.predictMode.prompts[0].controlId;
    delete missingTargetYaml.predictMode.prompts[0].actionId;
    expect(() => validateExperiment(missingTargetYaml, "lq-08")).toThrow();
  });
});
