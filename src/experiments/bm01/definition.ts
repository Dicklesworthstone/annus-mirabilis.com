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
export const TRACE_COUNT = 24,
  TRACE_POINTS = 101,
  HISTOGRAM_BINS = 40;
const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });
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
  tracerPositions: c("m", "synthetic-tracer-endpoints-xyz", "diffusion.recordTracers"),
  traceCoordinates: c("m", "synthetic-displacement-traces-xy", "diffusion.recordTracers"),
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
  recordingDraws: c("1", "logical-recording-draws", "diffusion.recordTracers"),
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
