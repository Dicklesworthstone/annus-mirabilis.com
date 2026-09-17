import { BM07_OUTPUTS, type Bm07Parameters } from "../../experiments/bm07/definition.ts";
import { observationDigestNumber } from "../../experiments/bm07/digest.ts";
import { validateBm07Parameters } from "../../experiments/bm07/parameters.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  INFERENCE_CONSTANTS,
  INFERENCE_GRID_DT,
  INFERENCE_GRID_STEPS,
  type InferenceExecutionOptions,
  type InferenceRecording,
  observationGrid,
  observeInferencePath,
  recordInferencePath,
} from "../../physics/reference/inference/synthetic.ts";
import {
  combinedMolecularNumberInterval,
  estimateIncrements,
  estimatorInterval,
  identifiabilityFamily,
  inverseBias,
  invertToMolecularNumber,
  type StatisticalInterval,
} from "../../physics/reference/inference.ts";
export type Bm07Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;
const identity = (id: string) => {
  const meta = BM07_OUTPUTS[id];
  if (!meta) throw new RangeError(`Unknown BM07 output: ${id}`);
  const { statuses: _, ...c } = meta;
  return { quantityId: id, ...c };
};
function number(
  id: string,
  value: number | Float64Array,
  ci?: StatisticalInterval,
  M = 1,
): ScientificResult {
  if (typeof value === "number" ? !Number.isFinite(value) : !value.every(Number.isFinite))
    throw new RangeError("Nonfinite inference output.");
  return {
    ...identity(id),
    status: "value",
    value,
    ...(ci
      ? {
          uncertainty: {
            kind: "statistical-interval" as const,
            lower: ci.lower,
            upper: ci.upper,
            coverage: ci.coverage,
            sampleSize: M,
            method: `${ci.coverageKind} under the declared model; ${ci.estimatorId}`,
          },
        }
      : {}),
  };
}
function absent(
  id: string,
  status: "underdetermined" | "not-applicable",
  reason: string,
): ScientificResult {
  return status === "underdetermined"
    ? { ...identity(id), status, compatibleFamily: reason, neededInformation: [reason] }
    : { ...identity(id), status, reason };
}
const pair = (ci: StatisticalInterval) => new Float64Array([ci.lower, ci.upper]);
const end = (outputs: readonly ScientificResult[]): Computation<Bm07Evaluation> => ({
  kind: "accepted",
  data: {
    outputs,
    stepIndex: INFERENCE_GRID_STEPS,
    simulationTime: INFERENCE_GRID_STEPS * INFERENCE_GRID_DT,
  },
});
const invariant = (): Computation<never> => ({
  kind: "outcome",
  outcome: { outcome: "invariant-violation", ...executionOutcomeRegistry["invariant-violation"] },
});
export async function createBm07Recording(
  input: unknown,
  options: InferenceExecutionOptions = {},
): Promise<Computation<InferenceRecording>> {
  const valid = validateBm07Parameters(input);
  if (valid.kind !== "accepted") return valid;
  const p = valid.data;
  if (p.observationSet !== "synthetic")
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { capabilityId: "diffusion.inference" },
        {
          details: {
            requirements:
              "The synthetic worker admits only the labeled inverse exercise. Historical rows and kitchen CSV use the host hand-off, not this recording.",
          },
        },
      ),
    };
  const grid = observationGrid(p.M, p.d, p.dt);
  if (grid.kind !== "accepted") return grid;
  return recordInferencePath(
    {
      seed: p.seed,
      generatorT: p.generatorT,
      generatorEta: p.generatorEta,
      generatorRadius: p.generatorRadius,
    },
    options,
  );
}
/** Statistics, intervals, families and coverage all belong here, never in JSX. */
export async function measureBm07(
  recording: InferenceRecording,
  p: Bm07Parameters,
  reused: boolean,
  options: InferenceExecutionOptions = {},
): Promise<Computation<Bm07Evaluation>> {
  const valid = validateBm07Parameters(p);
  if (valid.kind !== "accepted") return valid;
  if (p.observationSet !== "synthetic")
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { capabilityId: "diffusion.inference" },
        {
          details: {
            requirements:
              "The synthetic worker admits only the labeled inverse exercise. Historical rows and kitchen CSV use the host hand-off, not this recording.",
          },
        },
      ),
    };
  if (
    recording.steps !== INFERENCE_GRID_STEPS ||
    recording.replicate !== 0 ||
    (Object.keys(recording.setup) as (keyof typeof recording.setup)[]).some(
      (k) => !Object.is(recording.setup[k], p[k]),
    )
  )
    return invariant();
  const observation = observeInferencePath(recording, p);
  if (observation.kind !== "accepted") return observation;
  const outputs: ScientificResult[] = [
    number("sampleCount", p.M),
    number("generatorMolecularNumber", recording.hiddenNumber),
    number("generatorDiffusionCoefficient", recording.D),
    number("observationPositions", observation.data.positions),
    number("observationIncrements", observation.data.increments),
    number("observationTimes", observation.data.times),
    number("recordingDraws", recording.draws),
    number("reusedRecording", reused ? 1 : 0),
    number("retainedBytes", recording.positions.byteLength),
    number("observationDigest", observationDigestNumber(observation.data.increments)),
  ];
  const estimate = estimateIncrements(observation.data.increments, p.dt, p.d, p.estimator);
  if (estimate.kind === "refused" || estimate.kind === "outcome") return estimate;
  if (estimate.kind === "no-value") {
    for (const id of Object.keys(BM07_OUTPUTS))
      if (
        !outputs.some((r) => r.quantityId === id) &&
        !["degreesOfFreedom", "requestDraws", "coverageDraws"].includes(id)
      )
        outputs.push(absent(id, "underdetermined", estimate.reason));
    outputs.push(
      number("degreesOfFreedom", 0),
      number("requestDraws", reused ? 0 : recording.draws),
      number("coverageDraws", 0),
    );
    return end(outputs);
  }
  const e = estimate.data,
    ci = estimatorInterval(e, 1 - p.coverage);
  if (ci.kind !== "accepted") return ci;
  outputs.push(
    number("diffusionCoefficientEstimate", e.dHat, ci.data, p.M),
    number("diffusionInterval", pair(ci.data)),
    number("degreesOfFreedom", e.q),
    number("driftVelocity", e.drift),
    number("diffusionBiasFactor", e.biasFactor),
  );
  const bias = inverseBias(e.q, e.normalization);
  if (bias.kind === "refused" || bias.kind === "outcome") return bias;
  outputs.push(
    bias.kind === "accepted"
      ? number("inverseBiasFactor", bias.data.meanFactor)
      : absent("inverseBiasFactor", "not-applicable", bias.reason),
  );
  outputs.push(
    bias.kind === "accepted" && bias.data.varianceFactor !== null
      ? number("inverseVarianceFactor", bias.data.varianceFactor)
      : absent(
          "inverseVarianceFactor",
          "not-applicable",
          "The inverted estimate has no finite variance at four or fewer degrees of freedom.",
        ),
  );
  const family = identifiabilityFamily(
    { D: e.dHat, T: p.T, eta: p.eta, radiusRange: [0.1e-6, 2e-6], synthetic: true },
    INFERENCE_CONSTANTS,
  );
  if (family.kind === "refused" || family.kind === "outcome") return family;
  for (const [id, key] of [
    ["radiusNumberProduct", "product"],
    ["familyRadii", "radii"],
    ["familyNumbers", "numbers"],
  ] as const)
    outputs.push(
      family.kind === "accepted"
        ? number(id, family.data[key])
        : absent(id, "underdetermined", family.reason),
    );
  const conditions = {
    T: p.T,
    eta: p.eta,
    a: p.a,
    radiusProvenance: "independently-declared" as const,
    synthetic: true,
  };
  if (!p.radiusKnown)
    for (const id of ["avogadroNumberEstimate", "molecularInterval", "conditionalInterval"])
      outputs.push(
        absent(
          id,
          "underdetermined",
          "The data constrain a radius–number product, not radius and molecular number separately. Declare an independent radius to condition the estimate.",
        ),
      );
  else {
    const n = invertToMolecularNumber(
      { ...conditions, dHat: e.dHat, interval: ci.data },
      INFERENCE_CONSTANTS,
    );
    if (n.kind === "refused" || n.kind === "outcome") return n;
    if (n.kind === "no-value")
      for (const id of ["avogadroNumberEstimate", "molecularInterval", "conditionalInterval"])
        outputs.push(absent(id, "underdetermined", n.reason));
    else {
      outputs.push(number("conditionalInterval", pair(n.data.interval)));
      const bounds = (v: number, r: number) => ({
        lower: v * (1 - r),
        upper: v * (1 + r),
        coverage: p.inputCoverage,
      });
      const selected =
        p.intervalKind === "conditional"
          ? { kind: "accepted" as const, data: n.data.interval }
          : combinedMolecularNumberInterval(
              {
                ...conditions,
                estimate: e,
                alphaD: 1 - p.coverage - 3 * (1 - p.inputCoverage),
                inputs: {
                  T: bounds(p.T, p.temperatureError),
                  eta: bounds(p.eta, p.viscosityError),
                  a: bounds(p.a, p.radiusError),
                },
              },
              INFERENCE_CONSTANTS,
            );
      if (selected.kind === "refused" || selected.kind === "outcome") return selected;
      outputs.push(
        number(
          "avogadroNumberEstimate",
          n.data.estimate,
          selected.kind === "accepted" ? selected.data : undefined,
          p.M,
        ),
      );
      outputs.push(
        selected.kind === "accepted"
          ? number("molecularInterval", pair(selected.data))
          : absent("molecularInterval", "not-applicable", selected.reason),
      );
    }
  }
  let coverageDraws = 0;
  if (p.coverageTrials === 0 || p.intervalKind === "combined") {
    const reason =
      p.coverageTrials === 0
        ? "Run the hypothetical experiments explicitly to inspect interval coverage."
        : "The repeated-trial view tests conditional intervals only; it does not invent repeated input-measurement procedures for a combined interval.";
    for (const id of [
      "coverageDiffusion",
      "coverageMolecular",
      "diffusionCoveringCount",
      "molecularCoveringCount",
    ])
      outputs.push(absent(id, "not-applicable", reason));
  } else {
    const diff = new Float64Array(p.coverageTrials * 4),
      mol = new Float64Array(p.coverageTrials * 4);
    let dc = 0,
      nc = 0;
    for (let i = 0; i < p.coverageTrials; i++) {
      if (options.cancelled?.())
        return {
          kind: "outcome",
          outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
        };
      const trial = await recordInferencePath(
        recording.setup,
        options,
        i + 1,
        p.M * (p.dt / INFERENCE_GRID_DT),
      );
      if (trial.kind !== "accepted") return trial;
      coverageDraws += trial.data.draws;
      const seen = observeInferencePath(trial.data, p);
      if (seen.kind !== "accepted") return seen;
      const fitted = estimateIncrements(seen.data.increments, p.dt, p.d, p.estimator);
      if (fitted.kind !== "accepted") return invariant();
      const band = estimatorInterval(fitted.data, 1 - p.coverage);
      if (band.kind !== "accepted") return band;
      const covers = band.data.lower <= recording.D && recording.D <= band.data.upper;
      dc += Number(covers);
      diff.set(
        [
          fitted.data.dHat / recording.D,
          band.data.lower / recording.D,
          band.data.upper / recording.D,
          Number(covers),
        ],
        i * 4,
      );
      if (p.radiusKnown) {
        const n = invertToMolecularNumber(
          { ...conditions, dHat: fitted.data.dHat, interval: band.data },
          INFERENCE_CONSTANTS,
        );
        if (n.kind !== "accepted") return invariant();
        const coversN =
          n.data.interval.lower <= recording.hiddenNumber &&
          recording.hiddenNumber <= n.data.interval.upper;
        nc += Number(coversN);
        mol.set(
          [
            n.data.estimate / recording.hiddenNumber,
            n.data.interval.lower / recording.hiddenNumber,
            n.data.interval.upper / recording.hiddenNumber,
            Number(coversN),
          ],
          i * 4,
        );
      }
    }
    outputs.push(number("coverageDiffusion", diff), number("diffusionCoveringCount", dc));
    outputs.push(
      p.radiusKnown
        ? number("coverageMolecular", mol)
        : absent(
            "coverageMolecular",
            "underdetermined",
            "Declare an independent radius before testing the conditional molecular-number procedure.",
          ),
    );
    outputs.push(
      p.radiusKnown
        ? number("molecularCoveringCount", nc)
        : absent(
            "molecularCoveringCount",
            "underdetermined",
            "An independent radius is not yet declared.",
          ),
    );
  }
  outputs.push(
    number("coverageDraws", coverageDraws),
    number("requestDraws", (reused ? 0 : recording.draws) + coverageDraws),
  );
  return end(outputs);
}
