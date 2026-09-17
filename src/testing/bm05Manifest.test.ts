import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { BM05_DEFAULTS, BM05_PROMPT } from "../experiments/bm05/definition.ts";
import { validateBm05Parameters } from "../experiments/bm05/parameters.ts";
import { WALK_KERNELS } from "../physics/reference/diffusion/walkLaws.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadManifest() {
  const path = join(root, "content/experiments/bm-05.yaml");
  const raw = strictParse(readFileSync(path, "utf8"), "yaml") as Record<string, unknown>;
  return validateExperiment(raw, path);
}

function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

/**
 * am-bm-05-random-steps-ntzl: this manifest is new in this pass (content/experiments/bm-05.yaml
 * did not exist before). These tests check it against the schema and against the same real
 * source of truth the runtime already uses (src/experiments/bm05/*,
 * src/physics/reference/diffusion/walkLaws.ts), rather than treating the YAML as its own
 * ground truth, so a future edit to either side that drifts from the other fails here.
 */
describe("BM-05 manifest (content/experiments/bm-05.yaml)", () => {
  test("validates against the real Experiment schema", () => {
    const experiment = loadManifest();
    expect(experiment.id).toBe("bm-05");
    expect(experiment.outputs.some((o) => o.primary)).toBe(true);
  });

  test("export kernel ids in provenance match WALK_KERNELS, not a manifest-only copy", () => {
    const experiment = loadManifest();
    const ids = (experiment.provenance as { exportKernelIds: Record<string, number> })
      .exportKernelIds;
    expect(ids.coin).toBe(WALK_KERNELS.coin.stepKernel);
    expect(ids.uniform).toBe(WALK_KERNELS.uniform.stepKernel);
    expect(ids.gaussian).toBe(WALK_KERNELS.gaussian.stepKernel);
  });

  test("the binding doc's pinned revision and decision in provenance match the doc itself", () => {
    const experiment = loadManifest();
    const provenance = experiment.provenance as {
      frankenSimBindingRevision: string;
      frankenSimBindingDecision: string;
    };
    const binding = readFileSync(join(root, "docs/FRANKENSIM_BINDING.md"), "utf8");
    expect(binding).toContain(provenance.frankenSimBindingRevision);
    expect(binding).toContain(`\`${provenance.frankenSimBindingDecision}\`.`);
  });

  test("kernel parameter's enumerated domain matches WALK_KERNELS' own set of supported kernels", () => {
    const experiment = loadManifest();
    const kernelParam = experiment.parameters.find((p) => p.id === "kernel");
    expect(kernelParam?.modelDomain).toMatchObject({
      enumerated: Object.keys(WALK_KERNELS),
    });
  });

  test("parameter defaults match BM05_DEFAULTS, the runtime's real default record", () => {
    const experiment = loadManifest();
    const byId = new Map(experiment.parameters.map((p) => [p.id, p]));
    expect(byId.get("kernel")?.default).toBe(BM05_DEFAULTS.kernel);
    expect(byId.get("stepRms")?.default).toBe(BM05_DEFAULTS.stepRms);
    expect(byId.get("tau")?.default).toBe(BM05_DEFAULTS.tau);
    expect(byId.get("walkers")?.default).toBe(BM05_DEFAULTS.walkers);
    expect(byId.get("runSteps")?.default).toBe(BM05_DEFAULTS.runSteps);
    expect(byId.get("seed")?.default).toBe(BM05_DEFAULTS.seed);
    expect(byId.get("bias")?.default).toBe(BM05_DEFAULTS.bias);
  });

  test("parameter domains stay inside what validateBm05Parameters actually accepts", () => {
    const experiment = loadManifest();
    const byId = new Map(experiment.parameters.map((p) => [p.id, p]));
    const stepRms = must(byId.get("stepRms"), "manifest is missing parameter stepRms");
    const tau = must(byId.get("tau"), "manifest is missing parameter tau");
    const walkers = must(byId.get("walkers"), "manifest is missing parameter walkers");
    const runSteps = must(byId.get("runSteps"), "manifest is missing parameter runSteps");
    const bias = must(byId.get("bias"), "manifest is missing parameter bias");
    const check = (overrides: Partial<typeof BM05_DEFAULTS>) =>
      validateBm05Parameters({ ...BM05_DEFAULTS, ...overrides }).kind;
    expect(check({ stepRms: (stepRms.modelDomain as { min: number }).min })).toBe("accepted");
    expect(check({ tau: (tau.modelDomain as { min: number }).min })).toBe("accepted");
    expect(check({ walkers: (walkers.modelDomain as { min: number }).min })).toBe("accepted");
    expect(check({ walkers: (walkers.modelDomain as { max: number }).max })).toBe("accepted");
    expect(check({ runSteps: (runSteps.modelDomain as { min: number }).min, n: 0 })).toBe(
      "accepted",
    );
    expect(check({ runSteps: (runSteps.modelDomain as { max: number }).max })).toBe("accepted");
    expect(check({ bias: (bias.modelDomain as { min: number }).min })).toBe("accepted");
    expect(check({ bias: (bias.modelDomain as { max: number }).max })).toBe("accepted");
  });

  test("the registered predict prompt matches BM05_PROMPT exactly, including all three candidate ids", () => {
    const experiment = loadManifest();
    const predictMode = experiment.predictMode;
    if (!("prompts" in predictMode)) throw new Error("predictMode must be enabled.");
    const prompts = predictMode.prompts;
    expect(prompts).toHaveLength(1);
    const prompt = must(prompts[0], "predictMode.prompts is empty");
    expect(prompt.promptId).toBe(BM05_PROMPT.promptId);
    expect(prompt.controlId).toBe(BM05_PROMPT.controlId);
    expect(prompt.question).toBe(BM05_PROMPT.question);
    expect(prompt.candidates.map((c) => c.id)).toEqual(BM05_PROMPT.candidates.map((c) => c.id));
    expect(prompt.candidates.map((c) => c.id)).toEqual([
      "two-separate-piles",
      "same-bell-shape",
      "wider-bell",
    ]);
  });

  test("teachingTapes registers the real coin-to-bell tape (schema-valid, per its own file's caveat)", () => {
    const experiment = loadManifest();
    expect(experiment.teachingTapes).toEqual([{ tapeId: "coin-to-bell", title: "coin to bell" }]);
  });

  test("weavePredicates cites the real, tested bm05-s4-second-moment predicate id", () => {
    const experiment = loadManifest();
    expect(experiment.weavePredicates).toContain("bm05-s4-second-moment");
  });

  test("acceptanceCases and defaultScenario point at a real, passing scenario fixture", () => {
    const experiment = loadManifest();
    expect(experiment.acceptanceCases).toContain("bm-05-gaussian-step-diffusivity");
    expect(experiment.defaultScenario).toBe("bm-05-gaussian-step-diffusivity");
  });
});
