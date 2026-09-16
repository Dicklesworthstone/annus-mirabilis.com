import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { CATALOGUE_QUESTIONS, CATALOGUE_STATUS } from "../experiments/catalogue.ts";
import { LQ06_DEFAULTS, LQ06_OUTPUTS } from "../experiments/lq06/definition.ts";
import { OWNER_BINDINGS } from "../experiments/owners.ts";

describe("LQ-06 Manifest & Catalogue Verification (am-lq-06-coefficient-match-n8pe)", () => {
  it("has valid registered status in catalogue", () => {
    expect(CATALOGUE_STATUS["lq-06"]).toBe("registered");
    expect(CATALOGUE_QUESTIONS["lq-06"]).toContain("entropy volume law");
  });

  it("has valid owner binding pointing to createLq06Session", () => {
    const binding = OWNER_BINDINGS["lq-06"];
    expect(binding).toBeDefined();
    expect(binding?.kind).toBe("reference-evaluator");
    if (binding && binding.kind === "reference-evaluator") {
      expect(binding.module).toBe("src/experiments/lq06/session.ts");
      expect(binding.function).toBe("createLq06Session");
    }
  });

  it("manifest YAML is valid and matches schema contracts", () => {
    const manifestPath = resolve(process.cwd(), "content/experiments/lq-06.yaml");
    const raw = readFileSync(manifestPath, "utf8");
    const manifest = yaml.load(raw) as Record<string, unknown>;

    expect(manifest.id).toBe("lq-06");
    expect(manifest.schemaVersion).toBe(1);
    expect(Array.isArray(manifest.parameters)).toBe(true);
    expect(Array.isArray(manifest.outputs)).toBe(true);
    expect(manifest.predictMode).toBeDefined();

    const paramIds = (manifest.parameters as { id: string }[]).map((p) => p.id);
    expect(paramIds).toContain("radiationEnergy");
    expect(paramIds).toContain("frequency");
    expect(paramIds).toContain("gasParticles");
    expect(paramIds).toContain("volumeRatio");
    expect(paramIds).toContain("temperature");

    const outputIds = (manifest.outputs as { id: string }[]).map((o) => o.id);
    expect(outputIds).toContain("effectiveIndependentCount");
    expect(outputIds).toContain("quantumEnergy");
    expect(outputIds).toContain("radiationEntropy");
    expect(outputIds).toContain("entropyVolumeCoefficient");
    expect(outputIds).toContain("correspondenceVerdict");
  });

  it("definitions declare all necessary outputs", () => {
    expect(LQ06_OUTPUTS.effectiveIndependentCount).toBeDefined();
    expect(LQ06_OUTPUTS.quantumEnergy).toBeDefined();
    expect(LQ06_OUTPUTS.radiationEntropy).toBeDefined();
    expect(LQ06_OUTPUTS.entropyVolumeCoefficient).toBeDefined();
    expect(LQ06_DEFAULTS.radiationEnergy).toBe(9.055615e-9);
    expect(LQ06_DEFAULTS.frequency).toBe(6.0e14);
  });
});
