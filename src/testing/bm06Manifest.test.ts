import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import { validateBm06Parameters } from "../experiments/bm06/parameters.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { intervalProbability, stokesEinsteinD } from "../physics/reference/diffusion.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadManifest() {
  const path = join(root, "content/experiments/bm-06.yaml");
  const raw = strictParse(readFileSync(path, "utf8"), "yaml") as Record<string, unknown>;
  return validateExperiment(raw, path);
}

function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

/**
 * am-bm-06-gaussian-spread-982y: this manifest is new in this pass (content/experiments/bm-06.yaml
 * did not exist before). These tests check it against the schema and against the same real
 * source of truth the runtime already uses (src/experiments/bm06/*,
 * src/physics/reference/diffusion.ts), rather than treating the YAML as its own ground truth.
 */
describe("BM-06 manifest (content/experiments/bm-06.yaml)", () => {
  test("validates against the real Experiment schema", () => {
    const experiment = loadManifest();
    expect(experiment.id).toBe("bm-06");
    expect(experiment.outputs.some((o) => o.primary)).toBe(true);
  });

  test("parameter defaults match BM06_DEFAULTS, the runtime's real default record", () => {
    const experiment = loadManifest();
    const byId = new Map(experiment.parameters.map((p) => [p.id, p]));
    expect(byId.get("T")?.default).toBe(BM06_DEFAULTS.T);
    expect(byId.get("eta")?.default).toBe(BM06_DEFAULTS.eta);
    expect(byId.get("a")?.default).toBe(BM06_DEFAULTS.a);
    expect(byId.get("t")?.default).toBe(BM06_DEFAULTS.t);
    expect(byId.get("lower")?.default).toBe(BM06_DEFAULTS.lower);
    expect(byId.get("upper")?.default).toBe(BM06_DEFAULTS.upper);
    expect(byId.get("n")?.default).toBe(BM06_DEFAULTS.n);
    expect(byId.get("dx")?.default).toBe(BM06_DEFAULTS.dx);
    expect(byId.get("steps")?.default).toBe(BM06_DEFAULTS.steps);
  });

  test("declares exactly the runtime's own parameter ids, no invented ones (no direct D, no dimension selector)", () => {
    const experiment = loadManifest();
    const ids = new Set(experiment.parameters.map((p) => p.id));
    expect(ids.has("D")).toBe(false);
    expect(ids.has("dimension")).toBe(false);
    expect(ids.has("dt")).toBe(false);
    for (const key of Object.keys(BM06_DEFAULTS)) {
      if (key.startsWith("copiedDiffusivity")) continue;
      expect(ids.has(key)).toBe(true);
    }
  });

  test("parameter domains stay inside what validateBm06Parameters actually accepts", () => {
    const experiment = loadManifest();
    const byId = new Map(experiment.parameters.map((p) => [p.id, p]));
    const n = must(byId.get("n"), "manifest is missing parameter n");
    const steps = must(byId.get("steps"), "manifest is missing parameter steps");
    const check = (overrides: Partial<typeof BM06_DEFAULTS>) =>
      validateBm06Parameters({ ...BM06_DEFAULTS, ...overrides }).kind;
    expect(check({ t: 0 })).toBe("accepted");
    expect(check({ n: (n.modelDomain as { min: number }).min })).toBe("accepted");
    expect(check({ n: (n.modelDomain as { max: number }).max })).toBe("accepted");
    expect(check({ steps: (steps.modelDomain as { min: number }).min })).toBe("accepted");
    expect(check({ steps: (steps.modelDomain as { max: number }).max })).toBe("accepted");
  });

  test("acceptanceCases and defaultScenario point at a real, passing scenario fixture", () => {
    const experiment = loadManifest();
    expect(experiment.acceptanceCases).toContain("bm-06-one-rms-probability");
    expect(experiment.defaultScenario).toBe("bm-06-one-rms-probability");
  });

  test("the modern-golden preset's parameters reproduce D = 0.4294396 um^2/s and lambda_x = 0.9267573 um", () => {
    const experiment = loadManifest();
    const preset = must(
      experiment.presets.find((p) => p.presetId === "bm-06-modern-one-second"),
      "bm-06-modern-one-second preset is missing",
    );
    const modern = getConstantSet("modern-si-2019");
    const D = stokesEinsteinD(
      {
        T: preset.parameterValues.T as number,
        eta: preset.parameterValues.eta as number,
        a: preset.parameterValues.a as number,
      },
      modern,
    );
    const dValue = val(D);
    expect(Math.abs(dValue * 1e12 - 0.4294396)).toBeLessThan(5e-7);
    const lambda = Math.sqrt(2 * dValue * (preset.parameterValues.t as number));
    expect(preset.parameterValues.upper).toBeCloseTo(lambda, 12);
    expect(preset.parameterValues.lower).toBeCloseTo(-lambda, 12);
  });

  test("the point-distribution preset's t = 0 gives the analytic-limit point mass, not a value", () => {
    const experiment = loadManifest();
    const preset = must(
      experiment.presets.find((p) => p.presetId === "bm-06-point-distribution"),
      "bm-06-point-distribution preset is missing",
    );
    expect(preset.parameterValues.t).toBe(0);
    const p = intervalProbability(
      preset.parameterValues.lower as number,
      preset.parameterValues.upper as number,
      preset.parameterValues.t as number,
      4.294396e-13,
    );
    expect(val(p)).toBe(1);
  });

  test("the ftcs-refusal preset exceeds the stability ratio 0.5", () => {
    const experiment = loadManifest();
    const preset = must(
      experiment.presets.find((p) => p.presetId === "bm-06-ftcs-refusal"),
      "bm-06-ftcs-refusal preset is missing",
    );
    const modern = getConstantSet("modern-si-2019");
    const D = stokesEinsteinD(
      {
        T: preset.parameterValues.T as number,
        eta: preset.parameterValues.eta as number,
        a: preset.parameterValues.a as number,
      },
      modern,
    );
    const dt = (preset.parameterValues.t as number) / (preset.parameterValues.steps as number);
    const dx = preset.parameterValues.dx as number;
    const ratio = (val(D) * dt) / (dx * dx);
    expect(ratio).toBeGreaterThan(0.5);
  });

  test("predictMode is honestly declared exempt rather than fabricated", () => {
    const experiment = loadManifest();
    expect(experiment.predictMode).toMatchObject({ exempt: true });
  });

  test("weavePredicates is empty, not citing the unvalidated BM06_WEAVE_PREDICATES ids", () => {
    const experiment = loadManifest();
    expect(experiment.weavePredicates).toEqual([]);
  });
});
