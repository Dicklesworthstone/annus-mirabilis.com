import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import { validateBm06Parameters } from "../experiments/bm06/parameters.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  intervalProbability,
  mostLikelyRadius2d,
  stokesEinsteinD,
} from "../physics/reference/diffusion.ts";

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

  test("predictMode registers the bead's two prompts, each with exactly three stable candidates", () => {
    // This test asserted `{ exempt: true }` while the prompts were deferred, which was honest then
    // and is the shape that breaks when the debt is paid. The prompts landed on 2026-10-13, so it
    // now asserts the contract they owe rather than their absence.
    const experiment = loadManifest();
    const mode = experiment.predictMode as {
      enabled?: boolean;
      exempt?: boolean;
      prompts?: {
        promptId: string;
        supportedCandidateId?: string;
        controlId?: string;
        actionId?: string;
        candidates: { id: string; label?: string; description?: string }[];
      }[];
    };
    expect(mode.enabled).toBe(true);
    expect(mode.exempt).toBeUndefined();
    const prompts = mode.prompts ?? [];
    expect(prompts.map((p) => p.promptId)).toEqual([
      "bm-06-predict-within-one-typical-distance",
      "bm-06-predict-radial-most-likely",
    ]);
    for (const prompt of prompts) {
      // The grammar of am-cm-id-scheme-8bn, asserted rather than assumed.
      expect(prompt.promptId).toMatch(/^bm-06-predict-[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(prompt.candidates.length).toBe(3);
      expect(new Set(prompt.candidates.map((c) => c.id)).size).toBe(3);
      for (const candidate of prompt.candidates) {
        expect(candidate.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect((candidate.description ?? "").length).toBeGreaterThan(0);
      }
      // The supported candidate must be one the reader can actually choose.
      expect(prompt.candidates.map((c) => c.id)).toContain(
        must(prompt.supportedCandidateId, `${prompt.promptId} names no supported candidate`),
      );
    }
  });

  test("the first prompt's target is a control a preset sets, so a tour step can cite it", () => {
    // Not decoration: src/content/tours/tours.ts reads only `controlId`, so an action-targeted
    // prompt fails tour-tape-does-not-reveal-prompt whatever preset the step names.
    // am-tour-15min-brownian-z034's step 5 cites this prompt, which is why it targets a control.
    const experiment = loadManifest();
    const prompts =
      (experiment.predictMode as { prompts?: { promptId: string; controlId?: string }[] })
        .prompts ?? [];
    const first = must(
      prompts.find((p) => p.promptId === "bm-06-predict-within-one-typical-distance"),
      "the interval prompt must be registered",
    );
    const control = must(
      first.controlId,
      "the interval prompt must target a control, not an action",
    );
    expect(experiment.parameters.map((p) => p.id)).toContain(control);
    const preset = must(
      experiment.presets.find((p) => p.presetId === "bm-06-modern-one-second"),
      "the modern-golden preset must exist",
    );
    expect(Object.keys(preset.parameterValues)).toContain(control);
  });

  test("the interval prompt's supported candidate is what the owner computes at that preset", () => {
    // Read from the registered owner at the preset's own interval, not from a number typed here.
    // This is the same case as content/scenarios/bm-06-one-rms-probability.yaml, which proves it
    // through the scenario registry; this asserts the manifest's prose agrees with it.
    const experiment = loadManifest();
    const preset = must(
      experiment.presets.find((p) => p.presetId === "bm-06-modern-one-second"),
      "the modern-golden preset must exist",
    );
    const v = preset.parameterValues as Record<string, number>;
    const constants = getConstantSet("modern-si-2019");
    const D = val(
      stokesEinsteinD({ T: v.T as number, eta: v.eta as number, a: v.a as number }, constants),
    );
    const t = v.t as number;
    const lambda = Math.sqrt(2 * D * t);

    // TWO PRECISIONS, KEPT APART, because mixing them is what made the first draft of this test
    // fail by 2e-8. The preset's interval was authored from a D rounded to seven figures
    // (0.4294396 um^2/s, the number content/scenarios/bm-06-one-rms-probability.yaml also carries),
    // while `lambda` here comes from the full-precision Stokes-Einstein evaluation. So the model
    // claim is asserted at the exact interval, and the preset's agreement with it is asserted
    // separately, at the precision the preset was actually written to.
    const presetPrecision = 2e-7; // relative, from D's seven significant figures
    expect(Math.abs((v.upper as number) - lambda) / lambda).toBeLessThan(presetPrecision);
    expect(Math.abs((v.lower as number) + lambda) / lambda).toBeLessThan(presetPrecision);

    // THE MODEL CLAIM, at the exact one-RMS interval: erf(1/sqrt(2)), which is the share the
    // supported candidate `about-two-in-three` names.
    expect(val(intervalProbability(-lambda, lambda, t, D))).toBeCloseTo(0.682689492137, 9);
    // And what a reader of this preset actually sees, at the preset's own stored bounds: the same
    // number to the seven figures the candidate's prose quotes.
    expect(val(intervalProbability(v.lower as number, v.upper as number, t, D))).toBeCloseTo(
      0.6826895,
      7,
    );

    // The two candidates it has to be distinguished FROM, each at its own distance.
    expect(val(intervalProbability(-2 * lambda, 2 * lambda, t, D))).toBeCloseTo(0.954499736104, 9);
    const halfShareDistance = 0.6744898 * lambda;
    expect(val(intervalProbability(-halfShareDistance, halfShareDistance, t, D))).toBeCloseTo(
      0.5,
      7,
    );
    // So `about-half` names a SHORTER distance than the question asks about, which is the whole
    // separation between that wrong answer and the right one.
    expect(halfShareDistance).toBeLessThan(lambda);

    // THE PROSE'S OWN NUMBERS, checked rather than trusted. A separatingAssumption that quotes a
    // figure is the kind of thing that stays readable while going wrong, so each one the reveal
    // shows is reproduced here from the owner.
    const prompts =
      (
        experiment.predictMode as {
          prompts?: {
            promptId: string;
            candidates: { id: string; separatingAssumption: string }[];
          }[];
        }
      ).prompts ?? [];
    const byId = new Map(
      must(
        prompts.find((p) => p.promptId === "bm-06-predict-within-one-typical-distance"),
        "the interval prompt must be registered",
      ).candidates.map((c) => [c.id, c.separatingAssumption]),
    );
    expect(byId.get("about-half")).toContain("0.6744898");
    // Four decimals, not seven: at seven the figure depends on whether lambda came from the exact
    // Stokes-Einstein D or the preset's seven-figure one, and they part company in the last place.
    // Reader-facing prose has no business carrying a digit that unstable, so the prose quotes four
    // and this asserts four. (The first draft quoted seven and this check caught it.)
    expect(byId.get("about-half")).toContain(`${(halfShareDistance * 1e6).toFixed(4)} μm`);
    expect(byId.get("about-half")).toContain(`${(lambda * 1e6).toFixed(4)} μm`);
    expect(byId.get("about-two-in-three")).toContain("0.682689492137");
    expect(byId.get("about-95-in-100")).toContain("0.954499736104");
  });

  test("the radial prompt's supported candidate is the owner's own peak", () => {
    const experiment = loadManifest();
    const preset = must(
      experiment.presets.find((p) => p.presetId === "bm-06-modern-one-second"),
      "the modern-golden preset must exist",
    );
    const v = preset.parameterValues as Record<string, number>;
    const constants = getConstantSet("modern-si-2019");
    const D = val(
      stokesEinsteinD({ T: v.T as number, eta: v.eta as number, a: v.a as number }, constants),
    );
    const t = v.t as number;
    const peak = val(mostLikelyRadius2d(D, t));
    const lambda = Math.sqrt(2 * D * t);
    // `about-one-typical-distance`: the 2D radial peak IS the 1D RMS displacement.
    expect(peak).toBeCloseTo(lambda, 15);
    // An independent check that the peak is where the product actually turns over, so the claim
    // rests on the density rather than on the owner agreeing with itself.
    const density = (r: number) => r * Math.exp(-(r * r) / (4 * D * t));
    expect(density(peak)).toBeGreaterThan(density(peak * 0.9));
    expect(density(peak)).toBeGreaterThan(density(peak * 1.1));
    // And the two candidates it is distinguished from.
    expect(density(0)).toBe(0); // `at-the-start`: the circumference factor vanishes there
    expect(density(2 * peak)).toBeLessThan(density(peak)); // `about-twice-the-typical-distance`
  });

  test("the radial prompt targets an action this manifest registers", () => {
    const experiment = loadManifest();
    const prompts =
      (experiment.predictMode as { prompts?: { promptId: string; actionId?: string }[] }).prompts ??
      [];
    const radial = must(
      prompts.find((p) => p.promptId === "bm-06-predict-radial-most-likely"),
      "the radial prompt must be registered",
    );
    const action = must(radial.actionId, "the radial prompt must target an action");
    const registered = experiment.actions.find((a) => a.actionId === action);
    expect(registered, `${action} must be a registered action`).toBeDefined();
    // The action has to reveal the quantity the question asks about, or the prompt and its answer
    // could drift apart.
    expect(registered?.acceptedResult.outputs).toContain("mostLikelyRadius2d");
  });

  test("the schema refuses a prompt with two candidates or a duplicated candidate id", () => {
    // The negative a naive registration would fail: planted against the real validator, through
    // the real manifest, so neither the count rule nor the uniqueness rule can quietly lapse.
    const path = join(root, "content/experiments/bm-06.yaml");
    const raw = strictParse(readFileSync(path, "utf8"), "yaml") as Record<string, unknown>;
    const mode = raw.predictMode as { prompts: { candidates: { id: string }[] }[] };
    const prompt = must(mode.prompts[0], "the manifest must register a first prompt to plant into");
    const original = prompt.candidates;
    expect(original.length, "the plant needs three candidates to remove one from").toBe(3);
    const first = must(original[0], "candidate one");
    const second = must(original[1], "candidate two");

    prompt.candidates = original.slice(0, 2);
    expect(prompt.candidates.length).toBe(2);
    expect(() => validateExperiment(raw, path)).toThrow(/exactly 3 plausible candidates/);

    prompt.candidates = [first, second, first];
    expect(prompt.candidates.map((c) => c.id)).toEqual([first.id, second.id, first.id]);
    expect(() => validateExperiment(raw, path)).toThrow(/duplicated/);

    // The positive control: restored, the real manifest validates.
    prompt.candidates = original;
    expect(() => validateExperiment(raw, path)).not.toThrow();
  });

  test("weavePredicates is empty, not citing the unvalidated BM06_WEAVE_PREDICATES ids", () => {
    const experiment = loadManifest();
    expect(experiment.weavePredicates).toEqual([]);
  });
});
