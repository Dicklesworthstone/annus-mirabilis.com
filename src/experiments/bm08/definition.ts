import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
export type Bm08Parameters = Readonly<{
  seed: string; D: number; flowDrift: number; noiseSeed: string; clickSeed: string;
  M: number; d: number; dt: number; exposure: number; sigma: number; stageDrift: number; clicks: number;
  noiseMethod: "known" | "stationary"; coverage: number; coverageTrials: number;
}>;
export const BM08_DEFAULTS: Bm08Parameters = Object.freeze({ seed: "1905", D: .42944e-12, flowDrift: 0, noiseSeed: "1905", clickSeed: "1926", M: 100, d: 2, dt: 1, exposure: .5, sigma: .2e-6, stageDrift: 0, clicks: 30, noiseMethod: "stationary", coverage: .95, coverageTrials: 0 });
export const BM08_CLASSES: Readonly<Record<keyof Bm08Parameters, ParameterClass>> = Object.freeze({ seed: "input", D: "input", flowDrift: "input", noiseSeed: "measurement", clickSeed: "measurement", M: "measurement", d: "measurement", dt: "measurement", exposure: "measurement", sigma: "measurement", stageDrift: "measurement", clicks: "measurement", noiseMethod: "estimator", coverage: "estimator", coverageTrials: "estimator" });
export const BM08_MODEL = Object.freeze({ id: "bm08-camera-host-v1", label: "Synthetic camera experiment · later model, host calculation" });
const c = (unit: string, semanticKind: string, statuses: OutputContract["statuses"] = ["value"]): OutputContract => Object.freeze({ unit, semanticKind, ownerId: "inference.bm08", statuses });
const interval = ["value", "not-applicable"] as const;
export const BM08_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  naiveD: c("m2/s", "uncentered-camera-diffusion-estimate"), centeredD: c("m2/s", "centered-camera-diffusion-estimate"), covarianceD: c("m2/s", "unconstrained-known-drift-covariance-estimate"), pairD: c("m2/s", "unconstrained-noise-corrected-pair-estimate"),
  naiveInterval: c("m2/s", "admitted-independent-increment-interval", interval), centeredInterval: c("m2/s", "admitted-centered-increment-interval", interval), pairInterval: c("m2/s", "noise-aware-disjoint-pair-confidence-set", interval),
  covarianceNoiseVariance: c("m2", "unconstrained-covariance-noise-estimate"), stationaryNoiseVariance: c("m2", "independent-stationary-click-variance"), noiseInterval: c("m2", "declared-or-estimated-noise-bounds"),
  expectedVariance: c("m2", "camera-increment-variance"), expectedCovariance: c("m2", "camera-adjacent-increment-covariance"), sampleVariance: c("m2", "known-drift-increment-second-moment"), sampleCovariance: c("m2", "known-drift-adjacent-increment-product"), sdVariance: c("m2", "asymptotic-ma1-moment-standard-deviation"), sdCovariance: c("m2", "asymptotic-ma1-moment-standard-deviation"), naiveExpectation: c("m2/s", "uncentered-camera-estimator-expectation"),
  modelDiffusion: c("m2/s", "synthetic-generator-diffusivity"), driftFit: c("m/s", "fitted-apparent-coordinate-drift"), pairDegrees: c("1", "disjoint-pair-residual-degrees-of-freedom"), pairCount: c("1", "disjoint-frame-pair-count"), emptyPairInterval: c("1", "empty-physical-confidence-set"), pairLowerClipped: c("1", "confidence-set-boundary-intersection"),
  positions: c("m", "synthetic-camera-frame-positions"), idealPositions: c("m", "retained-latent-frame-start-positions"), blurredPositions: c("m", "exact-uniform-exposure-averages"), increments: c("m", "synthetic-camera-increments"), times: c("s", "frame-exposure-start-times"), stationaryClicks: c("m", "independent-stationary-feature-clicks"), latentWitness: c("m", "retained-latent-prefix-witness"),
  speedTimes: c("s", "hypothetical-zero-exposure-spacing"), idealSpeeds: c("m/s", "ideal-apparent-spread-speed"), cameraSpeeds: c("m/s", "noisy-zero-exposure-apparent-spread-speed"), speedRatios: c("1", "noise-to-ideal-apparent-speed-ratio"), speedCrossover: c("s", "zero-exposure-noise-crossover", interval),
  recordingDraws: c("1", "logical-latent-and-bridge-draws"), requestDraws: c("1", "new-latent-and-bridge-draws"), measurementDraws: c("1", "measurement-stream-evaluation-draws"), coverageDraws: c("1", "hypothetical-experiment-draws"), reusedRecording: c("1", "recording-cache-reuse"), reusedObservation: c("1", "measurement-cache-reuse"), retainedBytes: c("1", "retained-latent-recording-bytes"),
  coverageIntervals: c("1", "normalized-hypothetical-interval-comparison", interval), coverageNaiveCount: c("1", "observed-naive-procedure-covering-count"), coveragePairCount: c("1", "observed-pair-procedure-covering-count"), coverageEmptyCount: c("1", "observed-empty-pair-confidence-set-count"),
});
export function bm08Layout(id: string, p: Bm08Parameters): number | null {
  if (["naiveInterval", "centeredInterval", "pairInterval", "noiseInterval"].includes(id)) return 2;
  if (id === "driftFit") return p.d;
  if (["positions", "idealPositions", "blurredPositions"].includes(id)) return (p.M + 1) * p.d;
  if (id === "increments") return p.M * p.d;
  if (id === "times") return p.M + 1;
  if (id === "stationaryClicks") return p.clicks * p.d;
  if (id === "latentWitness") return 64;
  if (["speedTimes", "idealSpeeds", "cameraSpeeds", "speedRatios"].includes(id)) return 6;
  if (id === "coverageIntervals") return p.coverageTrials * 6;
  return null;
}
