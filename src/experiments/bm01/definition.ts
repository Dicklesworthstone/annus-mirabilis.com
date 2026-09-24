import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
import type { WeavePredicate } from "../weave/types.ts";
export type Bm01Parameters = Readonly<{
  T: number;
  eta: number;
  a: number;
  seed: string;
  M: number;
  h: number;
  H: number;
  interval: number;
  d: number;
  axis: number;
  statistic: string;
}>;
export const BM01_DEFAULTS: Bm01Parameters = Object.freeze({
  T: 293.15,
  eta: 0.001,
  a: 0.5e-6,
  seed: "1905",
  M: 400,
  h: 0.02,
  H: 10,
  interval: 1,
  d: 1,
  axis: 0,
  statistic: "rms",
});
export const BM01_CLASSES: Readonly<Record<keyof Bm01Parameters, ParameterClass>> = Object.freeze({
  T: "input",
  eta: "input",
  a: "input",
  seed: "input",
  M: "input",
  h: "input",
  H: "input",
  interval: "measurement",
  d: "measurement",
  axis: "measurement",
  statistic: "estimator",
});
export const BM01_MODEL = Object.freeze({
  id: "bm01-host-preview-v1",
  constantSetId: "modern-si-2019",
  label: "Synthetic trajectories · ideal model, host calculation",
});
/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-bm-01-tracer-ensemble-hdly.yaml, which the readings audit reads. */
export const BM01_CAPTION = Object.freeze({
  r0: "Hundreds of particles each take their own random path from the same start. Their average position stays near the start, but their typical distance from it keeps growing, as the square root of the time.",
  r1: "Section 4 assumes that each particle moves independently of every other, and that one particle's moves in successive short intervals τ are independent of each other, a displacement Δ being as likely as −Δ. From these assumptions the density of particles obeys a diffusion equation, and for particles that all start at x = 0 its solution is a Gaussian with mean zero and mean square 2Dt. The typical displacement along one axis is therefore λ_{x} = √(2Dt). It grows as the square root of the time, which is why four times the observation interval doubles the spread. The instrument draws such an ensemble and sets its sample mean and RMS beside the model's.",
  r2: "Follow one particle through one short interval τ. It moves by some amount Δ, as often to the right as to the left, so over many particles the average of Δ is zero. The average of Δ² is not zero, since a square is never negative; Section 4 writes that average as 2Dτ, which is how it defines the diffusion coefficient D. Now follow the particle for a longer time t. It makes n = t/τ such moves, one after another, and its position x is their sum. The average of a sum is the sum of the averages, so the average of x is still zero. For the average of x², write out the square of the sum: it holds each Δ² once and every product of two different moves. Two different moves are independent and each averages to zero, so every such product averages to zero as well, and only the n squares remain. The average of x² is therefore n × 2Dτ = (t/τ) × 2Dτ = 2Dt, and the typical distance is its square root, λ_{x} = √(2Dt). Four times the time gives √4 = 2 times the spread. Einstein's own numbers follow the same rule: for particles 0.001 mm across in water at 17 °C he found about 0.8 micron in one second and about 6 microns in one minute, because √60 is about 7.7 and 0.8 × 7.7 ≈ 6. This route adds the moves one at a time; Einstein's route in Section 4 reaches the same Gaussian through the diffusion equation.",
  r3: "Einstein printed λ_{x} = √(2Dt) in Section 4 and, putting in his Section 3 result D = (RT/N) · 1/(6πkP), λ_{x} = √t · √((RT/N) · 1/(3πkP)) in Section 5. In his notation k is the fluid's viscosity, not Boltzmann's constant, and P is the particle's radius. He did not claim to have explained an observed motion: the paper opens by saying these motions may be the Brownian motion, but that the reports available to him were too imprecise to judge. Langevin reached the same mean square in 1908 from an equation of motion with a random force, and Perrin's measurements of 1908 and 1909 used Einstein's formula to estimate N.",
});
export const TRACE_COUNT = 24,
  TRACE_POINTS = 101,
  HISTOGRAM_BINS = 40;
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
 * The two registered producers of a tracer recording: the host reference and FrankenSim's
 * compiled brownian_frames (am-frankensim-repin-and-bind-jvhg). The three outputs read straight
 * from the recording (tracerPositions, traceCoordinates, recordingDraws) admit both, name
 * whichever produced it, and all three name the same one (protocol/bm01.ts checks).
 */
export const BM01_HOST_RECORDER_OWNER = "diffusion.recordTracers";
export const BM01_FRANKENSIM_RECORDER_OWNER = "fs-wasm.brownian_frames";
export const BM01_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  temperature: c("K", "absolute-temperature", "bm01.acceptedInputs"),
  viscosity: c("Pa s", "dynamic-viscosity", "bm01.acceptedInputs"),
  particleRadius: c("m", "sphere-radius", "bm01.acceptedInputs"),
  observationInterval: c("s", "observation-interval", "bm01.acceptedInputs"),
  boltzmannConstant: c("J/K", "boltzmann-constant", "constants.modernSI2019"),
  diffusionCoefficient: c("m2/s", "latent-diffusivity", "diffusion.stokesEinsteinD"),
  rmsDisplacement1d: c("m", "latent-coordinate-rms", "diffusion.rmsDisplacement"),
  modelSecondMoment: c("m2", "latent-vector-second-moment", "diffusion.moments"),
  modelMeanNorm: c("m", "latent-mean-radius", "diffusion.moments"),
  modelRmsNorm: c("m", "latent-vector-rms", "diffusion.moments"),
  modelApparentSpeed: c("m/s", "interval-dependent-apparent-speed", "diffusion.apparentSpeed", [
    "value",
    "not-applicable",
  ]),
  sampledApparentSpeed: c("m/s", "sample-interval-speed", "diffusion.ensembleMoments", [
    "value",
    "not-applicable",
  ]),
  tracerPositions: c(
    "m",
    "synthetic-tracer-endpoints-xyz",
    BM01_HOST_RECORDER_OWNER,
    ["value"],
    [BM01_FRANKENSIM_RECORDER_OWNER],
  ),
  traceCoordinates: c(
    "m",
    "synthetic-displacement-traces-xy",
    BM01_HOST_RECORDER_OWNER,
    ["value"],
    [BM01_FRANKENSIM_RECORDER_OWNER],
  ),
  traceTimes: c("s", "recorded-trace-times", "bm01.measure"),
  sampleMean: c("m", "sample-coordinate-mean", "diffusion.ensembleMoments"),
  sampleMeanAbsolute: c("m", "sample-coordinate-absolute-mean", "diffusion.ensembleMoments"),
  sampleMeanSquare: c("m2", "sample-coordinate-second-moment", "diffusion.ensembleMoments"),
  sampleRms: c("m", "sample-coordinate-rms", "diffusion.ensembleMoments"),
  sampleMeanNorm: c("m", "sample-vector-mean-radius", "diffusion.ensembleMoments"),
  sampleMeanSquareNorm: c("m2", "sample-vector-second-moment", "diffusion.ensembleMoments"),
  sampleRmsNorm: c("m", "sample-vector-rms", "diffusion.ensembleMoments"),
  histogramEdges: c("m", "coordinate-bin-edges", "diffusion.displacementHistogram"),
  histogramCounts: c("1", "sample-bin-counts", "diffusion.displacementHistogram"),
  histogramFrequencies: c("1", "sample-bin-proportions", "diffusion.displacementHistogram"),
  histogramModel: c("1", "model-bin-probabilities", "diffusion.intervalProbability"),
  underflow: c("1", "sample-underflow-count", "diffusion.displacementHistogram"),
  overflow: c("1", "sample-overflow-count", "diffusion.displacementHistogram"),
  plotTimes: c("s", "recorded-comparison-times", "bm01.measure"),
  plotSampleMean: c("m", "sample-coordinate-mean", "bm01.measure"),
  plotSampleMsd: c("m2", "sample-vector-second-moment", "bm01.measure"),
  plotSampleRms: c("m", "sample-vector-rms", "bm01.measure"),
  plotSampleApparent: c("m/s", "sample-interval-dependent-speed", "bm01.measure"),
  plotModelMean: c("m", "model-coordinate-mean", "bm01.measure"),
  plotModelMsd: c("m2", "model-vector-second-moment", "bm01.measure"),
  plotModelRms: c("m", "model-vector-rms", "bm01.measure"),
  plotModelApparent: c("m/s", "model-interval-dependent-speed", "bm01.measure"),
  meanBand: c("m", "model-sampling-mean-band", "diffusion.ensembleMomentBands", [
    "value",
    "underdetermined",
    "analytic-limit",
  ]),
  secondMomentBand: c(
    "m2",
    "model-sampling-vector-second-moment-band",
    "diffusion.ensembleMomentBands",
    ["value", "underdetermined", "analytic-limit"],
  ),
  recordingDraws: c(
    "1",
    "logical-recording-draws",
    BM01_HOST_RECORDER_OWNER,
    ["value"],
    [BM01_FRANKENSIM_RECORDER_OWNER],
  ),
  reusedRecording: c("1", "recording-reuse-indicator", "bm01.measure"),
  ensembleSize: c("1", "sample-count", "bm01.acceptedInputs"),
  signedMean: c("m", "sample-coordinate-mean", "diffusion.ensembleMoments"),
  signedMeanLowerBand: c("m", "model-sampling-mean-lower-band", "diffusion.ensembleMomentBands", [
    "value",
    "underdetermined",
    "analytic-limit",
  ]),
  signedMeanUpperBand: c("m", "model-sampling-mean-upper-band", "diffusion.ensembleMomentBands", [
    "value",
    "underdetermined",
    "analytic-limit",
  ]),
  meanSquare: c("m2", "sample-coordinate-second-moment", "diffusion.ensembleMoments", [
    "value",
    "analytic-limit",
  ]),
  meanSquareLowerBand: c(
    "m2",
    "model-sampling-second-moment-lower-band",
    "diffusion.ensembleMomentBands",
    ["value", "underdetermined", "analytic-limit"],
  ),
  meanSquareUpperBand: c(
    "m2",
    "model-sampling-second-moment-upper-band",
    "diffusion.ensembleMomentBands",
    ["value", "underdetermined", "analytic-limit"],
  ),
  kolmogorovDistance: c(
    "1",
    "distribution-convergence-distance",
    "diffusion.displacementHistogram",
    ["value", "not-applicable"],
  ),
  lambdaX1s: c("m", "one-second-rms-displacement", "diffusion.rmsDisplacement"),
  lambdaX60s: c("m", "sixty-second-rms-displacement", "diffusion.rmsDisplacement"),
});
/** Recorded index selection is data layout, not a physical calculation. */
export function comparisonIndices(steps: number): readonly number[] {
  const indices = new Set<number>();
  for (let scale = 1; scale <= steps; scale *= 10)
    for (const multiplier of [1, 2, 5])
      if (scale * multiplier <= steps) indices.add(scale * multiplier);
  indices.add(steps);
  return [...indices].sort((a, b) => a - b);
}
export function bm01Layout(id: string, p: Bm01Parameters): number | null {
  if (id === "tracerPositions") return p.M * 3;
  if (id === "traceCoordinates") return Math.min(TRACE_COUNT, p.M) * TRACE_POINTS * 2;
  if (id === "traceTimes") return TRACE_POINTS;
  if (id === "histogramEdges") return HISTOGRAM_BINS + 1;
  if (["histogramCounts", "histogramFrequencies", "histogramModel"].includes(id))
    return HISTOGRAM_BINS;
  if (id.startsWith("plot")) return comparisonIndices(Math.round(p.H / p.h)).length;
  if (["meanBand", "secondMomentBand"].includes(id)) return 2;
  return null;
}

export const BM01_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "bm01-s4-cancellation",
    instrumentId: "bm-01",
    meaning: "agreement-within-stated-bound" as const,
    conditions: Object.freeze([
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "ensembleSize",
        direction: "at-least" as const,
        enter: 100,
        exit: 100,
      }),
      Object.freeze({
        kind: "agreement" as const,
        statisticQuantityId: "signedMean",
        sampleCountQuantityId: "ensembleSize",
        minimumSampleSize: 100,
        boundFamily: "owner-band" as const,
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
        lowerBoundQuantityId: "signedMeanLowerBand",
        upperBoundQuantityId: "signedMeanUpperBand",
      }),
      Object.freeze({
        kind: "agreement" as const,
        statisticQuantityId: "meanSquare",
        sampleCountQuantityId: "ensembleSize",
        minimumSampleSize: 100,
        boundFamily: "owner-band" as const,
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
        lowerBoundQuantityId: "meanSquareLowerBand",
        upperBoundQuantityId: "meanSquareUpperBand",
      }),
    ]),
    targets: Object.freeze(["bm-s4-cancellation"]),
    pointerText:
      "The signed mean and the mean square agree with the model band at the stated significance level, sample size 400, seed 1905.",
  }),
  Object.freeze({
    id: "bm01-s5-distribution-agreement",
    instrumentId: "bm-01",
    meaning: "agreement-within-stated-bound" as const,
    conditions: Object.freeze([
      Object.freeze({
        kind: "agreement" as const,
        statisticQuantityId: "kolmogorovDistance",
        sampleCountQuantityId: "ensembleSize",
        minimumSampleSize: 100,
        boundFamily: "dkw" as const,
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
      }),
    ]),
    targets: Object.freeze(["bm-s5-lambda-x"]),
    pointerText:
      "The sampled displacement histogram agrees with the model Gaussian within the stated bound, sample size 400, seed 1905.",
  }),
  Object.freeze({
    id: "bm01-s5-printed-numbers",
    instrumentId: "bm-01",
    meaning: "assumption-active" as const,
    conditions: Object.freeze([
      Object.freeze({
        kind: "regime" as const,
        on: "constantSet",
        equals: "einstein-1905-brownian-printed",
      }),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "lambdaX1s",
        direction: "at-least" as const,
        enter: 0.75,
        exit: 0.75,
      }),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "lambdaX60s",
        direction: "at-least" as const,
        enter: 5.5,
        exit: 5.5,
      }),
    ]),
    targets: Object.freeze(["bm-s5-printed-numbers"]),
    pointerText: "The historical constant set einstein-1905-brownian-printed is currently active.",
  }),
]);
