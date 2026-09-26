import type { PredictPrompt } from "../../content/schemas/experiment.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
export type Bm05Parameters = Readonly<{
  kernel: "coin" | "uniform" | "gaussian";
  stepRms: number;
  tau: number;
  walkers: number;
  runSteps: number;
  n: number;
  seed: string;
  bias: number;
}>;
export const BM05_DEFAULTS: Bm05Parameters = Object.freeze({
  kernel: "coin",
  stepRms: 0.5e-6,
  tau: 0.1,
  walkers: 2000,
  runSteps: 400,
  n: 4,
  seed: "1905",
  bias: 0.6,
});
export const BM05_CLASSES: Readonly<Record<keyof Bm05Parameters, ParameterClass>> = Object.freeze({
  kernel: "input",
  stepRms: "input",
  tau: "input",
  walkers: "input",
  runSteps: "input",
  seed: "input",
  n: "measurement",
  bias: "estimator",
});
export const BM05_MODEL = Object.freeze({
  id: "bm05-host-preview-v1",
  constantSetId: "not-applicable",
  label: "Synthetic independent steps · ideal model, host calculation",
});
export const WALK_TRACE_POINTS = 101;
/**
 * Conforms to the real `PredictPrompt`/`PredictCandidate` shape
 * (`src/content/schemas/experiment.ts`, am-cm-schemas-experiment-fuu), so
 * am-inst-predict-mode-ti7m's predict-state and storage modules can consume
 * it directly. The accepted candidate is `same-bell-shape`: the central
 * limit theorem is exactly the claim that a zero-mean, finite-variance step
 * law's limiting distribution depends on the variance, not the step
 * law's shape.
 */
export const BM05_PROMPT: PredictPrompt = Object.freeze({
  promptId: "bm-05-predict-step-shape",
  controlId: "kernel",
  question: "After many steps, what will changing the step law while keeping its variance do?",
  candidates: Object.freeze([
    Object.freeze({
      id: "two-separate-piles",
      label: "Keep two separate piles",
      description:
        "The two step laws never converge; the walk's spread keeps a visible trace of which law produced it.",
      separatingAssumption:
        "That would hold if the two step laws produced genuinely different limiting distributions — a bias, or a variance that never settles. Coin, uniform, and Gaussian steps here are all zero-mean with the same finite variance, and the central limit theorem says any such step law converges to the same Gaussian after enough independent steps, so the two piles must merge rather than stay apart.",
    }),
    Object.freeze({
      id: "same-bell-shape",
      label: "Approach the same bell shape and spread",
      description:
        "Both step laws converge to the same Gaussian, because only the per-step variance controls the limit.",
      separatingAssumption:
        "This is what the central limit theorem guarantees for any zero-mean, finite-variance step law: after enough independent steps, the sum's distribution converges to a Gaussian whose spread depends only on the number of steps and the per-step variance, never on the step law's shape.",
    }),
    Object.freeze({
      id: "wider-bell",
      label: "Make a wider bell despite the same variance",
      description:
        "The resulting spread is wider than the coin-step case even though the per-step variance matches.",
      separatingAssumption:
        "That would hold if the resulting spread depended on some property of the step law beyond its variance — a heavier tail inflating the typical size, for instance. Holding the variance fixed already fixes the limiting Gaussian's width; a different step shape with the same variance converges to the identical spread, not a wider one.",
    }),
  ]),
});
const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
  admittedOwnerIds?: readonly string[],
): OutputContract =>
  Object.freeze({
    unit,
    semanticKind,
    ownerId,
    statuses: Object.freeze([...statuses]),
    ...(admittedOwnerIds ? { admittedOwnerIds: Object.freeze([...admittedOwnerIds]) } : {}),
  });
/**
 * FrankenSim's compiled philox_normals, when it draws a Gaussian walk's steps
 * (am-frankensim-repin-and-bind-jvhg, dispatch 269). The outputs read straight from the draws
 * (the recorded positions and traces, and both draw counts) admit it beside their host owner and
 * name one producer between them (protocol/bm05.ts checks). Only a Gaussian walk draws normals.
 */
export const BM05_FRANKENSIM_DRAW_OWNER = "fs-wasm.philox_normals";
const law = (unit: string, owner: string, statuses: OutputContract["statuses"] = ["value"]) =>
  c(unit, "declared-step-model", `diffusion.${owner}`, statuses);
export const BM05_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  stepMean: law("m", "kernelMoments"),
  stepSecondMoment: law("m2", "kernelMoments"),
  stepFourthMoment: law("m4", "kernelMoments"),
  diffusionCoefficient: law("m2/s", "kernelDiffusivity"),
  stepKurtosis: c("1", "step-excess-kurtosis", "bm05.measure"),
  sumKurtosis: c("1", "sum-excess-kurtosis", "bm05.measure", ["value", "not-applicable"]),
  sampleMean: c("m", "sample-coordinate-mean", "diffusion.ensembleMoments"),
  sampleMeanSquare: c("m2", "sample-coordinate-second-moment", "diffusion.ensembleMoments"),
  sampleRms: c("m", "sample-coordinate-rms", "diffusion.ensembleMoments"),
  modelMeanSquare: c("m2", "model-coordinate-second-moment", "diffusion.randomWalkMoments"),
  modelRms: c("m", "model-coordinate-rms", "diffusion.randomWalkMoments"),
  elapsedTime: c("s", "selected-step-time", "diffusion.randomWalkMoments"),
  kolmogorovDistance: c(
    "1",
    "sample-cdf-distance-to-gaussian",
    "diffusion.kolmogorovDistanceToGaussian",
    ["value", "not-applicable"],
  ),
  shapeTerm: c("1", "kernel-sum-cdf-distance-to-gaussian", "diffusion.kolmogorovShapeTerm", [
    "value",
    "not-applicable",
  ]),
  samplingTerm: c("1", "dkw-sampling-bound", "diffusion.dkwBound"),
  walkerCount: c("1", "sample-count", "bm05.measure"),
  agreementBound: c("1", "shape-plus-sampling-bound", "bm05.measure", ["value", "not-applicable"]),
  withinBound: c("1", "sample-within-declared-bound", "bm05.measure", ["value", "not-applicable"]),
  walkPositions: c(
    "m",
    "synthetic-walk-endpoints",
    "diffusion.recordWalks",
    ["value"],
    [BM05_FRANKENSIM_DRAW_OWNER],
  ),
  traceTimes: c("s", "sampled-trace-times", "bm05.measure"),
  traceDisplacements: c(
    "m",
    "sampled-walk-traces",
    "diffusion.recordWalks",
    ["value"],
    [BM05_FRANKENSIM_DRAW_OWNER],
  ),
  histogramEdges: c("m", "step-aligned-bin-edges", "bm05.measure"),
  histogramCounts: c("1", "all-walker-bin-counts", "diffusion.displacementHistogram"),
  histogramFrequencies: c("1", "all-walker-bin-proportions", "diffusion.displacementHistogram"),
  histogramGaussian: c("1", "gaussian-bin-probabilities", "diffusion.intervalProbability"),
  histogramExact: c("1", "finite-step-bin-probabilities", "bm05.measure"),
  underflow: c("1", "sample-underflow-count", "diffusion.displacementHistogram"),
  overflow: c("1", "sample-overflow-count", "diffusion.displacementHistogram"),
  coinPositions: c("m", "exact-coin-support", "diffusion.coinWalkDistribution", [
    "value",
    "not-applicable",
  ]),
  coinProbabilities: c("1", "exact-coin-probabilities", "diffusion.coinWalkDistribution", [
    "value",
    "not-applicable",
  ]),
  coinNumerators: c("1", "exact-binomial-numerators", "diffusion.coinWalkDistribution", [
    "value",
    "not-applicable",
  ]),
  coinDenominator: c("1", "exact-binomial-denominator", "diffusion.coinWalkDistribution", [
    "value",
    "not-applicable",
  ]),
  comparisonSteps: c("1", "recorded-comparison-steps", "bm05.measure"),
  comparisonSampleMsd: c("m2", "sample-second-moment-history", "bm05.measure"),
  comparisonModelMsd: c("m2", "model-second-moment-history", "bm05.measure"),
  comparisonDistance: c("1", "sample-distance-history", "bm05.measure"),
  comparisonShape: c("1", "shape-term-history", "bm05.measure"),
  recordingDraws: c(
    "1",
    "logical-realization-draws",
    "diffusion.recordWalks",
    ["value"],
    [BM05_FRANKENSIM_DRAW_OWNER],
  ),
  requestDraws: c("1", "executed-random-draws-this-request", "bm05.measure"),
  replayedDraws: c(
    "1",
    "deterministic-replay-draws",
    "diffusion.observeWalks",
    ["value"],
    [BM05_FRANKENSIM_DRAW_OWNER],
  ),
  reusedRecording: c("1", "recording-reuse-indicator", "bm05.measure"),
  retainedBytes: c("1", "private-recording-bytes", "bm05.measure"),
  biasedDiffusion: law("m2/s", "kernelDiffusivity", ["value", "outside-domain"]),
  biasedMean: law("m", "kernelMoments"),
  biasedDrift: law("m/s", "kernelDiffusivity"),
  biasedCenteredDiffusion: law("m2/s", "kernelDiffusivity"),
  cauchyDiffusion: law("m2/s", "kernelDiffusivity", ["outside-domain"]),
  continuumLimit: law("m2/s", "continuumLimit", ["outside-domain"]),
  continuumIntervals: c("s", "analytic-limit-intervals", "bm05.measure"),
  fixedStepCoefficients: c("m2/s", "fixed-step-coefficient-sequence", "diffusion.continuumLimit"),
  fixedRatioSteps: c("m", "fixed-diffusion-step-sequence", "bm05.measure"),
  fixedRatioCoefficients: c("m2/s", "fixed-ratio-coefficient-sequence", "diffusion.continuumLimit"),
});
/**
 * Validated against the real am-read-result-weave-jex contract (src/experiments/weave/types.ts,
 * validate.ts): `walkerCount` is a real BM05_OUTPUTS key (added alongside this declaration,
 * wired in src/workers/operations/bm05.ts) rather than a bare parameter reference, because
 * validateWeavePredicate requires every agreement condition's quantity ids to resolve to a
 * declared instrument output. `targets` names a placeholder sentence id: am-edn-inventory-
 * brownian-slg (the Brownian source-id inventory) is still open, so no real §4 sentence id
 * exists yet to cite. src/testing/bm05Weave.test.ts proves this against the real validator and
 * evaluator on scripted snapshots, not just its shape.
 */
export const BM05_WEAVE_PREDICATES = Object.freeze([
  Object.freeze({
    id: "bm05-s4-second-moment",
    instrumentId: "bm-05",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s4-second-moment"]),
    pointerText:
      "the sampled histogram agrees with the Gaussian of the same second moment within the stated bound.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "agreement" as const,
        statisticQuantityId: "kolmogorovDistance",
        sampleCountQuantityId: "walkerCount",
        minimumSampleSize: 400,
        offsetQuantityId: "shapeTerm",
        boundFamily: "dkw" as const,
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
      }),
    ]),
  }),
]);
export function bm05BinCount(p: Bm05Parameters): number {
  return p.n === 0 ? 1 : p.kernel === "coin" ? Math.min(41, p.n + 1) : 40;
}
export function walkComparisonSteps(p: Bm05Parameters): readonly number[] {
  return [
    ...new Set(
      [4, 16, 64, 400]
        .filter((n) => n <= p.runSteps)
        .concat([Math.min(p.runSteps, 400), ...(p.n > 0 ? [p.n] : [])]),
    ),
  ].sort((a, b) => a - b);
}
export function bm05Layout(id: string, p: Bm05Parameters): number | null {
  if (id === "walkPositions") return p.walkers;
  if (id === "traceTimes") return WALK_TRACE_POINTS;
  if (id === "traceDisplacements") return Math.min(20, p.walkers) * WALK_TRACE_POINTS;
  if (id === "histogramEdges") return bm05BinCount(p) + 1;
  if (id.startsWith("histogram")) return bm05BinCount(p);
  if (["coinPositions", "coinProbabilities", "coinNumerators"].includes(id)) return p.n + 1;
  if (id.startsWith("comparison")) return walkComparisonSteps(p).length;
  if (
    [
      "continuumIntervals",
      "fixedStepCoefficients",
      "fixedRatioSteps",
      "fixedRatioCoefficients",
    ].includes(id)
  )
    return 4;
  return null;
}

/**
 * The instrument's four readings (R0 to R3), checked against §4 of the Brownian paper (transcript
 * ap-17-549, Annalen pp. 556–559) and against the prepared default snapshot (bm05-example.json):
 * D = 1.25 μm²/s, model mean square 1 μm² after 4 steps against the sample's 0.9865 μm², the exact
 * coin distribution 1, 4, 6, 4, 1 sixteenths, the shape term 0.1875, and the biased-coin mean
 * 0.1 μm and drift 1 μm/s. The readings-owners record am-bm-05-random-steps-ntzl.yaml carries the same text.
 */
export const BM05_CAPTION = Object.freeze({
  r0: "A particle jostled by molecules takes many small, independent steps. Whatever the shape of one step, so long as it is symmetric and very large steps are rare enough, the spread after many steps grows as the square root of the time, and its shape comes to look like a bell curve.",
  r1: "Section 4 of the Brownian paper supposes an interval τ short compared with any time we observe, but long enough that a particle's motions in successive intervals are independent, and a law φ(Δ) for the displacement Δ in one interval that is symmetric, φ(Δ) = φ(−Δ), and nonzero only for small Δ. Expanding the new distribution in powers of Δ, symmetry removes the odd terms and the second-order term leaves the diffusion equation ∂f/∂t = D ∂^{2}f/∂x^{2}, with D = (1/τ)∫(Δ^{2}/2)φ(Δ)dΔ. From a point start its solution is the Gaussian law of errors, with root-mean-square displacement λ_{x} = √(2Dt). The instrument makes the argument concrete with walkers that step every τ = 0.1 s: coin steps of ±0.5 μm, or uniform or Gaussian steps with the same root-mean-square size. All three give D = (0.5 μm)^{2}/(2 × 0.1 s) = 1.25 μm^{2}/s and the same mean square after n steps, n × 0.25 μm^{2}. What differs is the shape. After 4 coin steps the exact distribution is 1, 4, 6, 4 and 1 sixteenths, whose cumulative probability differs from the Gaussian's by up to 0.1875, and the difference shrinks as the steps add up.",
  r2: "Follow one walker. Every τ = 0.1 s it takes a step Δ: with the coin, +0.5 μm or −0.5 μm, equally likely. After n steps its position is the sum x_{n} = Δ_{1} + Δ_{2} + … + Δ_{n}. Each step averages to zero, because +0.5 and −0.5 are equally likely, so the average position stays at the start. Now square the sum. It contains the n squared steps, Δ_{1}^{2} + … + Δ_{n}^{2}, and cross terms such as 2Δ_{1}Δ_{2}. Each squared coin step is exactly 0.25 μm^{2}. A cross term averages to zero when the steps are independent, since Δ_{1}Δ_{2} is +0.25 μm^{2} and −0.25 μm^{2} equally often. So the average of x_{n}^{2} is n × 0.25 μm^{2}. After 4 steps, 0.4 s, that is 1 μm^{2}, a root-mean-square distance of 1 μm; the 2000 simulated walkers give 0.9865 μm^{2} and 0.993 μm. Since t = nτ, the mean square is (0.25 μm^{2}/0.1 s) × t, which is 2Dt with D = 0.25/(2 × 0.1) = 1.25 μm^{2}/s, Einstein's D = (1/τ)∫(Δ^{2}/2)φ(Δ)dΔ written for a coin. For the shape, count paths. Four coin steps make 2^{4} = 16 equally likely paths. The walker ends at +2 μm only if all four steps go right, 1 path; at +1 μm if three do, 4 paths; at 0 if two do, 6 paths; then 4 and 1 on the left. So the chances are 1/16, 4/16, 6/16, 4/16 and 1/16, that is 0.0625, 0.25, 0.375, 0.25 and 0.0625, and the walkers' histogram gives 0.0625, 0.2455, 0.381, 0.251 and 0.06. The Gaussian with the same mean square puts 0.383 in the middle bin and 0.061 in each outer one. Einstein's route goes through the diffusion equation instead. The number of particles at x after one more interval is a sum over every displacement Δ that could bring them there, f(x, t + τ) = ∫f(x + Δ, t)φ(Δ)dΔ. Expand f(x + Δ, t) = f + Δ ∂f/∂x + (Δ^{2}/2) ∂^{2}f/∂x^{2} + …. The term in Δ averages to zero by symmetry, the constant term gives f back, and what is left is τ ∂f/∂t = (∂^{2}f/∂x^{2}) ∫(Δ^{2}/2)φ(Δ)dΔ, the diffusion equation. Two assumptions carry the weight. With a biased coin that steps right 0.6 of the time, the mean step is 0.6 × 0.5 − 0.4 × 0.5 = 0.1 μm and the crowd drifts at 1 μm/s, a first-order term the argument drops. With Cauchy-shaped steps the variance is infinite, and no finite D exists.",
  r3: "Einstein reaches D through the diffusion equation, not by adding steps: the 1905 paper never writes the mean square of a sum of n steps, and its τ is an interval chosen for the argument, not a tick of the motion. He called the Gaussian result what was to be expected, the law of random errors, and added that the root-mean-square total displacement in three dimensions is λ_{x}√3. Smoluchowski reached the square-root law by a kinetic argument in 1906, with a numerical factor differing from Einstein's by 64/27. Pearson named the random walk in a letter to Nature in 1905, and Rayleigh answered from his 1880 work on vibrations of random phase; Bachelier had used the same diffusion equation for prices in 1900. The shape test here, a Kolmogorov distance with a Dvoretzky–Kiefer–Wolfowitz bound on sampling error, is statistics of 1933 and 1956.",
});
