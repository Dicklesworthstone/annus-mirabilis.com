import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
export type Bm08Parameters = Readonly<{
  seed: string;
  D: number;
  flowDrift: number;
  noiseSeed: string;
  clickSeed: string;
  M: number;
  d: number;
  dt: number;
  exposure: number;
  sigma: number;
  stageDrift: number;
  clicks: number;
  noiseMethod: "known" | "stationary";
  coverage: number;
  coverageTrials: number;
}>;
export const BM08_DEFAULTS: Bm08Parameters = Object.freeze({
  seed: "1905",
  D: 0.42944e-12,
  flowDrift: 0,
  noiseSeed: "1905",
  clickSeed: "1926",
  M: 100,
  d: 2,
  dt: 1,
  exposure: 0.5,
  sigma: 0.2e-6,
  stageDrift: 0,
  clicks: 30,
  noiseMethod: "stationary",
  coverage: 0.95,
  coverageTrials: 0,
});
export const BM08_CLASSES: Readonly<Record<keyof Bm08Parameters, ParameterClass>> = Object.freeze({
  seed: "input",
  D: "input",
  flowDrift: "input",
  noiseSeed: "measurement",
  clickSeed: "measurement",
  M: "measurement",
  d: "measurement",
  dt: "measurement",
  exposure: "measurement",
  sigma: "measurement",
  stageDrift: "measurement",
  clicks: "measurement",
  noiseMethod: "estimator",
  coverage: "estimator",
  coverageTrials: "estimator",
});
export const BM08_MODEL = Object.freeze({
  id: "bm08-camera-host-v1",
  label: "Synthetic camera experiment · later model, host calculation",
});
const c = (
  unit: string,
  semanticKind: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract => Object.freeze({ unit, semanticKind, ownerId: "inference.bm08", statuses });
const interval = ["value", "not-applicable"] as const;
export const BM08_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  naiveD: c("m2/s", "uncentered-camera-diffusion-estimate"),
  centeredD: c("m2/s", "centered-camera-diffusion-estimate"),
  covarianceD: c("m2/s", "unconstrained-known-drift-covariance-estimate"),
  pairD: c("m2/s", "unconstrained-noise-corrected-pair-estimate"),
  naiveInterval: c("m2/s", "admitted-independent-increment-interval", interval),
  centeredInterval: c("m2/s", "admitted-centered-increment-interval", interval),
  pairInterval: c("m2/s", "noise-aware-disjoint-pair-confidence-set", interval),
  covarianceNoiseVariance: c("m2", "unconstrained-covariance-noise-estimate"),
  stationaryNoiseVariance: c("m2", "independent-stationary-click-variance"),
  noiseInterval: c("m2", "declared-or-estimated-noise-bounds"),
  expectedVariance: c("m2", "camera-increment-variance"),
  expectedCovariance: c("m2", "camera-adjacent-increment-covariance"),
  sampleVariance: c("m2", "known-drift-increment-second-moment"),
  sampleCovariance: c("m2", "known-drift-adjacent-increment-product"),
  sdVariance: c("m2", "asymptotic-ma1-moment-standard-deviation"),
  sdCovariance: c("m2", "asymptotic-ma1-moment-standard-deviation"),
  naiveExpectation: c("m2/s", "uncentered-camera-estimator-expectation"),
  modelDiffusion: c("m2/s", "synthetic-generator-diffusivity"),
  driftFit: c("m/s", "fitted-apparent-coordinate-drift"),
  pairDegrees: c("1", "disjoint-pair-residual-degrees-of-freedom"),
  pairCount: c("1", "disjoint-frame-pair-count"),
  emptyPairInterval: c("1", "empty-physical-confidence-set"),
  pairLowerClipped: c("1", "confidence-set-boundary-intersection"),
  positions: c("m", "synthetic-camera-frame-positions"),
  idealPositions: c("m", "retained-latent-frame-start-positions"),
  blurredPositions: c("m", "exact-uniform-exposure-averages"),
  increments: c("m", "synthetic-camera-increments"),
  times: c("s", "frame-exposure-start-times"),
  stationaryClicks: c("m", "independent-stationary-feature-clicks"),
  latentWitness: c("m", "retained-latent-prefix-witness"),
  speedTimes: c("s", "hypothetical-zero-exposure-spacing"),
  idealSpeeds: c("m/s", "ideal-apparent-spread-speed"),
  cameraSpeeds: c("m/s", "noisy-zero-exposure-apparent-spread-speed"),
  speedRatios: c("1", "noise-to-ideal-apparent-speed-ratio"),
  speedCrossover: c("s", "zero-exposure-noise-crossover", interval),
  recordingDraws: c("1", "logical-latent-and-bridge-draws"),
  requestDraws: c("1", "new-latent-and-bridge-draws"),
  measurementDraws: c("1", "measurement-stream-evaluation-draws"),
  coverageDraws: c("1", "hypothetical-experiment-draws"),
  reusedRecording: c("1", "recording-cache-reuse"),
  reusedObservation: c("1", "measurement-cache-reuse"),
  retainedBytes: c("1", "retained-latent-recording-bytes"),
  coverageIntervals: c("1", "normalized-hypothetical-interval-comparison", interval),
  coverageNaiveCount: c("1", "observed-naive-procedure-covering-count"),
  coveragePairCount: c("1", "observed-pair-procedure-covering-count"),
  coverageEmptyCount: c("1", "observed-empty-pair-confidence-set-count"),
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

/**
 * The instrument's four readings (R0 to R3). The 1905 paper treats positions as exact, so these
 * are checked against the owner rather than a section: the prepared default snapshot
 * (bm08-example.json) at D = 0.4294 μm²/s, σ = 0.2 μm, T_e = 0.5 s, τ = 1 s: expected variance
 * 0.796 μm² and covariance 0.032 μm², naive expectation 0.398 μm²/s, sample naive 0.406, CVE 0.510,
 * pairs 0.476 in [0.326, 0.697], crossover 0.093 s. These replace the record's earlier bm-08 texts,
 * whose R1 and R2 were lists of topics; am-bm-08-measurement-bias-h1ye.yaml carries the same text.
 */
export const BM08_CAPTION = Object.freeze({
  r0: "A camera does not record exactly where a particle is: it smears the motion over each exposure and adds a small error to every position. Both change the spread you measure, although the particle's own path is the same, and the lab shows which ways of estimating still give the right answer.",
  r1: "The instrument keeps a particle's own wandering, with D = 0.429 μm^{2}/s, apart from what a camera records. Each recorded position carries an error of standard deviation σ = 0.2 μm, and each frame averages the motion over an exposure of 0.5 s in a 1 s interval. A recorded step then has variance 2D(τ − T_{e}/3) + 2σ^{2} = 0.716 + 0.080 = 0.796 μm^{2}, not 2Dτ, and neighbouring steps are correlated, by DT_{e}/3 − σ^{2} = 0.032 μm^{2}: the blur links them positively and the shared noisy position links them negatively. Dividing the variance by 2τ, as the 1905 formula would, expects 0.398 μm^{2}/s, 7 percent low, and this sample gives 0.406; its textbook interval is refused, because the steps are no longer independent. Two estimators allow for the camera. One adds the neighbouring covariance to the variance and gives 0.510 here; one uses only disjoint pairs of frames and gives 0.476, with a 95 percent interval from 0.326 to 0.697 μm^{2}/s that contains the true value. Below τ = σ^{2}/D = 0.093 s the camera's jitter outweighs the particle's own motion in any speed computed from positions.",
  r2: "Write each recorded position as the true position, averaged over the exposure, plus an error of variance σ^{2}. A recorded step is the difference of two such positions, and its variance has two parts. The motion: over an interval τ a step has mean square 2Dτ, but each position is an average over the exposure T_{e}, and averaging a random walk over a window removes a third of that window's share, so the motion contributes 2D(τ − T_{e}/3). With D = 0.4294 μm^{2}/s, τ = 1 s and T_{e} = 0.5 s, that is 2 × 0.4294 × (1 − 0.1667) = 0.716 μm^{2}. The errors: a step contains two independent position errors, 2σ^{2} = 2 × 0.04 = 0.080 μm^{2}. In all, 0.796 μm^{2}. Now take two neighbouring steps. They share one position, whose error enters the first with a plus sign and the second with a minus sign, so it gives them a covariance of −σ^{2} = −0.040 μm^{2}; the blur makes them share a little motion, +DT_{e}/3 = 0.4294 × 0.1667 = 0.072 μm^{2}. Their covariance is 0.072 − 0.040 = 0.032 μm^{2}. The 1905 rule, D = variance/(2τ), then expects 0.796/2 = 0.398 μm^{2}/s instead of 0.429. Adding twice the covariance to the variance cancels both the blur and the noise terms, (0.796 + 2 × 0.032)/(2τ) = 0.429 on average, though with 100 steps its scatter is large, and this sample gives 0.510. Using only disjoint pairs of frames keeps every pair independent, at the cost of half the data: 0.476 μm^{2}/s, with an interval from 0.326 to 0.697. Finally the speed: the camera adds 2σ^{2} to each step's mean square and the particle adds 2Dτ, and they are equal when τ = σ^{2}/D = 0.04/0.4294 = 0.093 s.",
  r3: "None of this is in the 1905 paper, which treats every position as exact. Einstein did warn, in 1906 and again in 1907, that a speed computed as displacement over time grows as the interval shrinks, so it is not the particle's speed. The blur term comes from studies of camera exposure in particle tracking (Savin and Doyle, 2005), the full model of variance and covariance is Berglund's (2010), and the estimator that uses the covariance is due to Vestergaard, Blainey and Flyvbjerg (2014).",
});
