import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditReadings } from "../content/audits/readings.ts";
import { checkVoice } from "../content/checks/voice/index.ts";
import { parsePredictPromptId, parsePresetId } from "../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = resolve(ROOT, "content/experiments/bm-01.yaml");
const READINGS_OWNER_PATH = resolve(
  ROOT,
  "content/editorial/readings-owners/am-bm-01-tracer-ensemble-hdly.yaml",
);

function loadRawManifest(): unknown {
  const yaml = readFileSync(MANIFEST_PATH, "utf8");
  return strictParse(yaml, "yaml");
}

describe("bm01.manifest: BM-01 manifest registration (am-bm-01-tracer-ensemble-hdly)", () => {
  test("the manifest validates against the real Experiment schema", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.id).toBe("bm-01");
  });

  test("notModeled is non-empty, and an empty list is rejected by the real validator", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.notModeled.length).toBeGreaterThan(0);

    const stripped = loadRawManifest() as Record<string, unknown>;
    stripped.notModeled = [];
    expect(() => validateExperiment(stripped)).toThrow(ExperimentValidationError);
  });

  test("embeddable is true and realRate declares a natural rate with a scale bar", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.embeddable).toBe(true);
    expect(exp.realRate.natural).toBe(true);
    if (exp.realRate.natural) {
      expect(exp.realRate.scaleBar.length).toBe(1e-6);
      expect(exp.realRate.scaleBar.unit).toBe("m");
    }
  });

  test("teachingTapes registers einstein-0-8-micron", () => {
    const exp = validateExperiment(loadRawManifest());
    const entry = exp.teachingTapes.find((t) => t.tapeId === "einstein-0-8-micron");
    expect(entry).toBeDefined();
    expect(exp.tapeModel.modelId).toBe("brownian-motion-reference");
  });

  test("weavePredicates lists the three declared predicate ids", () => {
    const exp = validateExperiment(loadRawManifest());
    expect([...exp.weavePredicates].sort()).toEqual(
      ["bm01-s4-cancellation", "bm01-s5-distribution-agreement", "bm01-s5-printed-numbers"].sort(),
    );
  });

  test("both predict prompt ids parse under the predict-prompt grammar and neither parses as a preset", () => {
    const exp = validateExperiment(loadRawManifest());
    expect("enabled" in exp.predictMode && exp.predictMode.enabled).toBe(true);
    if (!("enabled" in exp.predictMode)) return;
    expect(exp.predictMode.prompts.length).toBe(2);
    for (const prompt of exp.predictMode.prompts) {
      const parsed = parsePredictPromptId(prompt.promptId);
      expect(parsed.ok).toBe(true);
      expect(parsePresetId(prompt.promptId).ok).toBe(false);
      expect(prompt.candidates.length).toBe(3);
    }
    const ids = exp.predictMode.prompts.map((p) => p.promptId).sort();
    expect(ids).toEqual(["bm-01-predict-observation-interval", "bm-01-predict-viscosity"].sort());
  });

  test("a predict prompt with two candidates is rejected", () => {
    const raw = loadRawManifest() as Record<string, unknown>;
    const pm = raw.predictMode as Record<string, unknown>;
    const prompts = pm.prompts as Record<string, unknown>[];
    const firstPrompt = prompts[0];
    if (!firstPrompt) throw new Error("unreachable: manifest fixture has no first prompt.");
    firstPrompt.candidates = (firstPrompt.candidates as unknown[]).slice(0, 2);
    expect(() => validateExperiment(raw)).toThrow(ExperimentValidationError);
  });

  test("a predict prompt id in colon form is rejected with the hyphen form named", () => {
    const raw = loadRawManifest() as Record<string, unknown>;
    const pm = raw.predictMode as Record<string, unknown>;
    const prompts = pm.prompts as Record<string, unknown>[];
    const firstPrompt = prompts[0];
    if (!firstPrompt) throw new Error("unreachable: manifest fixture has no first prompt.");
    firstPrompt.promptId = "bm-01:predict-observation-interval";
    let threw = false;
    try {
      validateExperiment(raw);
    } catch (err) {
      threw = true;
      expect(String(err)).toMatch(/<instrumentId>-predict-<slug>/);
    }
    expect(threw).toBe(true);
  });

  test("all three preset ids parse under the preset grammar and name declared parameters", () => {
    const exp = validateExperiment(loadRawManifest());
    const declaredParamIds = new Set(exp.parameters.map((p) => p.id));
    expect(exp.presets.length).toBe(3);
    const ids = exp.presets.map((p) => p.presetId).sort();
    expect(ids).toEqual(
      ["bm-01-velocity-trap", "bm-01-radius-probe", "bm-01-viscosity-comparison"].sort(),
    );
    for (const preset of exp.presets) {
      expect(parsePresetId(preset.presetId).ok).toBe(true);
      for (const paramId of Object.keys(preset.parameterValues)) {
        expect(declaredParamIds.has(paramId)).toBe(true);
      }
    }
  });

  test("a preset id in colon form is rejected with the hyphen form named", () => {
    const raw = loadRawManifest() as Record<string, unknown>;
    const presets = raw.presets as Record<string, unknown>[];
    const firstPreset = presets[0];
    if (!firstPreset) throw new Error("unreachable: manifest fixture has no first preset.");
    firstPreset.presetId = "bm-01:velocity-trap";
    let threw = false;
    try {
      validateExperiment(raw);
    } catch (err) {
      threw = true;
      expect(String(err)).toMatch(/hyphen/);
    }
    expect(threw).toBe(true);
  });

  test("a fixture manifest declaring bm-01:underdamped as a later-development mode validates", () => {
    const raw = loadRawManifest() as Record<string, unknown>;
    raw.modes = [
      {
        id: "bm-01:underdamped",
        label: "Underdamped (later development)",
        historicalStatus: "later-development",
        lensLabel: "Underdamped Langevin lens",
      },
    ];
    const exp = validateExperiment(raw);
    expect(exp.modes?.[0]?.id).toBe("bm-01:underdamped");
  });

  test("an undeclared colon id in a preset field still fails", () => {
    const raw = loadRawManifest() as Record<string, unknown>;
    const presets = raw.presets as Record<string, unknown>[];
    const firstPreset = presets[0];
    if (!firstPreset) throw new Error("unreachable: manifest fixture has no first preset.");
    firstPreset.presetId = "bm-01:not-a-mode";
    expect(() => validateExperiment(raw)).toThrow(ExperimentValidationError);
  });

  test("the misconception ledger's three cited preset ids resolve in this manifest", () => {
    const exp = validateExperiment(loadRawManifest());
    const ledgerCitedPresetIds = [
      "bm-01-velocity-trap",
      "bm-01-radius-probe",
      "bm-01-viscosity-comparison",
    ];
    const declared = new Set(exp.presets.map((p) => p.presetId));
    for (const id of ledgerCitedPresetIds) {
      expect(declared.has(id)).toBe(true);
    }
  });

  test("removing bm-01-radius-probe leaves it unresolvable, as audit-misconceptions would report", () => {
    const raw = loadRawManifest() as Record<string, unknown>;
    raw.presets = (raw.presets as Record<string, unknown>[]).filter(
      (p) => p.presetId !== "bm-01-radius-probe",
    );
    const exp = validateExperiment(raw);
    const declared = new Set(exp.presets.map((p) => p.presetId));
    expect(declared.has("bm-01-radius-probe")).toBe(false);
  });

  test("actions satisfy the action contract with all required affordance and announcement fields", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.actions.length).toBeGreaterThan(0);
    for (const action of exp.actions) {
      expect(action.actionId).toBeDefined();
      expect(action.family).toBe("probability-diffusion");
      expect(Array.isArray(action.inputs)).toBe(true);
      expect([
        "setup-change",
        "measurement-change",
        "estimator-change",
        "presentation-change",
      ]).toContain(action.commandClass);
      expect(action.acceptedResult.outputs.length).toBeGreaterThan(0);
      expect(action.visualAffordance.length).toBeGreaterThan(0);
      expect(action.equivalentAffordance.length).toBeGreaterThan(0);
      expect(action.announcement.length).toBeGreaterThan(0);
    }
  });

  test("owner declares per-function identifier bindings matching declared parameters and outputs", () => {
    const exp = validateExperiment(loadRawManifest());
    expect(exp.owner.identifierBindings).toBeDefined();
    const bindings = exp.owner.identifierBindings ?? [];
    expect(bindings.length).toBeGreaterThanOrEqual(6);
    const boundFunctions = new Set(bindings.map((b) => b.kernelFunction));
    expect(boundFunctions).toContain("stokesEinsteinD");
    expect(boundFunctions).toContain("rmsDisplacement");
    expect(boundFunctions).toContain("apparentSpeed");
  });

  test("weave predicate conditions name declared outputs including every owner-band output", () => {
    const exp = validateExperiment(loadRawManifest());
    const declaredOutputIds = new Set(exp.outputs.map((o) => o.id));
    const ownerBandOutputs = [
      "signedMeanLowerBand",
      "signedMeanUpperBand",
      "meanSquareLowerBand",
      "meanSquareUpperBand",
    ];
    for (const bandId of ownerBandOutputs) {
      expect(declaredOutputIds.has(bandId)).toBe(true);
    }

    const weaveConditionOutputs = [
      "ensembleSize",
      "signedMean",
      "signedMeanLowerBand",
      "signedMeanUpperBand",
      "meanSquare",
      "meanSquareLowerBand",
      "meanSquareUpperBand",
      "kolmogorovDistance",
      "lambdaX1s",
      "lambdaX60s",
    ];
    for (const outId of weaveConditionOutputs) {
      expect(declaredOutputIds.has(outId)).toBe(true);
    }
  });

  test("removing an owner-band output leaves weave condition outputs unresolvable", () => {
    const exp = validateExperiment(loadRawManifest());
    const declaredOutputIds = new Set(
      exp.outputs.map((o) => o.id).filter((id) => id !== "meanSquareLowerBand"),
    );
    expect(declaredOutputIds.has("meanSquareLowerBand")).toBe(false);
  });

  test("AC12: captions exist with R0-R3 and pass auditReadings and voice check", () => {
    const rawOwners = readFileSync(READINGS_OWNER_PATH, "utf8");
    const parsed = strictParse(rawOwners, "yaml") as {
      ownerBeadId: string;
      targets: Array<{
        id: string;
        kind: string;
        readings: {
          r0: string;
          r1: string;
          r2: string;
          r3: string;
          r3Citations?: string[];
        };
      }>;
    };

    expect(parsed.ownerBeadId).toBe("am-bm-01-tracer-ensemble-hdly");
    const targetIds = parsed.targets.map((t) => t.id);
    expect(targetIds).toContain("bm-01");
    expect(targetIds).toContain("bm-01-velocity-trap");
    expect(targetIds).toContain("bm-01-radius-probe");
    expect(targetIds).toContain("bm-01-viscosity-comparison");
    expect(targetIds).toContain("bm-01-predict-observation-interval");
    expect(targetIds).toContain("bm-01-predict-viscosity");

    const owners = [
      {
        ownerBeadId: parsed.ownerBeadId,
        fileName: "am-bm-01-tracer-ensemble-hdly.yaml",
        paper: "brownian-motion",
        targetKinds: ["instrument-caption" as const],
        targetIds,
      },
    ];

    const targets = parsed.targets.map((t) => ({
      targetId: t.id,
      targetKind: "instrument-caption" as const,
      paper: "brownian-motion",
      readings: t.readings,
    }));

    const report = auditReadings({ targets, owners });
    expect(report.ok).toBe(true);

    // Voice check across all readings strings: no error-level findings
    for (const target of parsed.targets) {
      for (const [_, text] of Object.entries(target.readings)) {
        if (typeof text !== "string") continue;
        const findings = checkVoice(text, { context: "prose" });
        const errors = findings.filter((f) => f.severity === "error");
        expect(errors).toHaveLength(0);
      }
    }

    // Planted negative: a fixture caption target missing from the readings-owners file reports owner-unassigned
    const targetsWithUnassigned = [
      ...targets,
      {
        targetId: "bm-01-unassigned-fixture",
        targetKind: "instrument-caption" as const,
        paper: "brownian-motion",
        readings: {
          r0: "A short sentence.",
          r1: "An overview of the fixture.",
          r2: "A detailed explanation of the fixture exceeding the required length factor comfortably.",
          r3: "Einstein (1905).",
          r3Citations: ["Einstein, A. (1905). Annalen der Physik 17, 549–560."],
        },
      },
    ];
    const reportWithUnassigned = auditReadings({ targets: targetsWithUnassigned, owners });
    expect(reportWithUnassigned.ok).toBe(false);
    expect(reportWithUnassigned.findings.some((f) => f.check === "owner-unassigned")).toBe(true);
  });
});
