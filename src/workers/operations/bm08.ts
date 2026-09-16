import { BM08_OUTPUTS, type Bm08Parameters } from "../../experiments/bm08/definition.ts";
import { validateBm08Parameters } from "../../experiments/bm08/parameters.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  CAMERA_GRID_DT,
  CAMERA_GRID_STEPS,
  type CameraFrames,
  type CameraOptions,
  type CameraRecording,
  cameraGrid,
  observeCameraPath,
  recordCameraPath,
} from "../../physics/reference/inference/camera.ts";
import {
  bartlettBandsMA1,
  cameraMoments,
  covarianceEstimator,
  disjointPairsKnownNoiseInterval,
  stationaryClickNoiseEstimate,
} from "../../physics/reference/inference/observation.ts";
import {
  type Assessment,
  estimateIncrements,
  estimatorInterval,
  type StatisticalInterval,
} from "../../physics/reference/inference.ts";
export type Bm08Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;
const requireValue = <T>(r: Assessment<T>): T => {
  if (r.kind !== "accepted") throw new Error("Validated camera calculation failed.");
  return r.data;
};
export function createBm08Recording(p: Bm08Parameters, options: CameraOptions = {}) {
  return recordCameraPath({ seed: p.seed, D: p.D, flowDrift: p.flowDrift }, options);
}
function analyze(f: CameraFrames, p: Bm08Parameters) {
  const naive = requireValue(
    estimateIncrements(f.increments, p.dt, p.d, "independent-increment-known-zero-drift"),
  );
  const centered = requireValue(estimateIncrements(f.increments, p.dt, p.d, "drift-centered"));
  const noise = requireValue(stationaryClickNoiseEstimate(f.stationary, { d: p.d }));
  const pair = requireValue(
    disjointPairsKnownNoiseInterval({
      positions: f.observed,
      dt: p.dt,
      exposure: p.exposure,
      d: p.d,
      alpha: 1 - p.coverage,
      noise:
        p.noiseMethod === "known"
          ? { kind: "exact", sigma2: p.sigma ** 2 }
          : { kind: "stationary-clicks", estimate: noise },
    }),
  );
  return { naive, centered, noise, pair };
}
export async function measureBm08(
  recording: CameraRecording,
  input: unknown,
  reused: boolean,
  options: CameraOptions = {},
  cachedFrames?: CameraFrames,
): Promise<Computation<Bm08Evaluation>> {
  const checked = validateBm08Parameters(input);
  if (checked.kind !== "accepted") return checked;
  const p = checked.data,
    grid = cameraGrid(p);
  if (grid.kind !== "accepted") return grid;
  if (
    recording.setup.seed !== p.seed ||
    recording.setup.D !== p.D ||
    recording.setup.flowDrift !== p.flowDrift ||
    recording.steps !== CAMERA_GRID_STEPS ||
    recording.replicate !== 0
  )
    throw new Error("Wrong latent recording.");
  const frames = cachedFrames
    ? { kind: "accepted" as const, data: cachedFrames }
    : observeCameraPath(recording, p);
  if (frames.kind !== "accepted") return frames;
  const f = frames.data,
    a = analyze(f, p),
    outputs: ScientificResult[] = [];
  function value(id: string, n: number | Float64Array) {
    const c = BM08_OUTPUTS[id]!;
    outputs.push({
      quantityId: id,
      unit: c.unit,
      semanticKind: c.semanticKind,
      ownerId: c.ownerId,
      status: "value",
      value: n,
    });
  }
  function unavailable(id: string, reason: string) {
    const c = BM08_OUTPUTS[id]!;
    outputs.push({
      quantityId: id,
      unit: c.unit,
      semanticKind: c.semanticKind,
      ownerId: c.ownerId,
      status: "not-applicable",
      reason,
    });
  }
  function interval(id: string, band: StatisticalInterval) {
    value(id, Float64Array.of(band.lower, band.upper));
  }
  const totalDrift = p.flowDrift + p.stageDrift;
  const m = requireValue(
    cameraMoments({
      D: p.D,
      dt: p.dt,
      exposure: p.exposure,
      sigma: p.sigma,
      drift: totalDrift,
      d: p.d,
    }),
  );
  const sample = requireValue(
    covarianceEstimator(f.increments, p.dt, {
      d: p.d,
      exposure: p.exposure,
      knownDrift: totalDrift,
    }),
  );
  const bands = requireValue(bartlettBandsMA1(m.variance, m.covariance, p.M, p.d));
  const scalars = {
    naiveD: a.naive.dHat,
    centeredD: a.centered.dHat,
    covarianceD: sample.D,
    pairD: a.pair.estimate,
    covarianceNoiseVariance: sample.sigma2,
    stationaryNoiseVariance: a.noise.sigma2,
    expectedVariance: m.variance,
    expectedCovariance: m.covariance,
    sampleVariance: sample.variance,
    sampleCovariance: sample.covariance,
    sdVariance: bands.sdVariance,
    sdCovariance: bands.sdCovariance,
    naiveExpectation: m.naiveExpectation,
    modelDiffusion: p.D,
    pairDegrees: a.pair.q,
    pairCount: a.pair.pairs,
    emptyPairInterval: Number(a.pair.empty),
    pairLowerClipped: Number(a.pair.lowerClipped),
    recordingDraws: recording.draws,
    requestDraws: reused ? 0 : recording.draws,
    measurementDraws: cachedFrames ? 0 : f.measurementDraws,
    reusedRecording: Number(reused),
    reusedObservation: Number(!!cachedFrames),
    retainedBytes: recording.bytes,
  };
  for (const [id, n] of Object.entries(scalars)) value(id, n);
  value("driftFit", a.centered.drift);
  value("noiseInterval", Float64Array.from(a.pair.noiseInterval));
  if (p.sigma === 0 && p.exposure === 0 && totalDrift === 0)
    interval("naiveInterval", requireValue(estimatorInterval(a.naive, 1 - p.coverage)));
  else
    unavailable(
      "naiveInterval",
      "The zero-drift independent-increment interval does not apply to noisy, exposed, or drifting observations. Its point estimate remains visible as a deliberately naive comparison.",
    );
  if (p.sigma === 0 && p.exposure === 0)
    interval("centeredInterval", requireValue(estimatorInterval(a.centered, 1 - p.coverage)));
  else
    unavailable(
      "centeredInterval",
      "Fitting drift does not remove camera noise or the adjacent-increment correlation. The simple centered chi-square interval is not admitted.",
    );
  if (a.pair.interval) interval("pairInterval", a.pair.interval);
  else
    unavailable(
      "pairInterval",
      "Empty physical confidence set: the inferred variance is incompatible with nonnegative diffusion at this coverage. This is retained as a miss, not redrawn or replaced by a positive interval.",
    );
  for (const [id, data] of Object.entries({
    positions: f.observed,
    idealPositions: f.ideal,
    blurredPositions: f.blurred,
    increments: f.increments,
    times: f.times,
    stationaryClicks: f.stationary,
    latentWitness: recording.positions.slice(0, 64),
  }))
    value(id, data);
  const speedTimes = Float64Array.of(4, 1, 0.25, 0.0625, 0.01, 0.0025),
    ideal = new Float64Array(6),
    noisy = ideal.slice(),
    ratios = ideal.slice();
  for (let i = 0; i < 6; i++) {
    const speed = requireValue(
      cameraMoments({ D: p.D, dt: speedTimes[i]!, exposure: 0, sigma: p.sigma, drift: 0, d: 1 }),
    );
    ideal[i] = speed.idealApparentSpeed;
    noisy[i] = speed.measuredApparentSpeed;
    ratios[i] = speed.apparentSpeedRatio;
  }
  value("speedTimes", speedTimes);
  value("idealSpeeds", ideal);
  value("cameraSpeeds", noisy);
  value("speedRatios", ratios);
  if (p.sigma > 0) value("speedCrossover", p.sigma ** 2 / p.D);
  else
    unavailable(
      "speedCrossover",
      "With zero localization noise there is no noise-dominated crossover.",
    );
  let coverageDraws = 0,
    naiveCount = 0,
    pairCount = 0,
    emptyCount = 0;
  const coverageRows = new Float64Array(p.coverageTrials * 6);
  for (let i = 0; i < p.coverageTrials; i++) {
    const generated = await recordCameraPath(
      recording.setup,
      options,
      i + 1,
      p.M * grid.data.stride + grid.data.exposureSteps,
    );
    if (generated.kind !== "accepted") return generated;
    const observed = observeCameraPath(generated.data, p);
    if (observed.kind !== "accepted") return observed;
    const trial = analyze(observed.data, p),
      naive = requireValue(estimatorInterval(trial.naive, 1 - p.coverage)),
      pair = trial.pair.interval;
    coverageDraws += generated.data.draws + observed.data.measurementDraws;
    const naiveHit = naive.lower <= p.D && p.D <= naive.upper,
      pairHit = !!pair && pair.lower <= p.D && p.D <= pair.upper;
    naiveCount += Number(naiveHit);
    pairCount += Number(pairHit);
    emptyCount += Number(!pair);
    // Empty sets have explicit flags; zero placeholders are not interval bounds.
    coverageRows.set(
      [
        naive.lower / p.D,
        naive.upper / p.D,
        pair ? pair.lower / p.D : 0,
        pair ? pair.upper / p.D : 0,
        Number(!pair),
        Number(pairHit),
      ],
      i * 6,
    );
  }
  value("coverageDraws", coverageDraws);
  if (p.coverageTrials) value("coverageIntervals", coverageRows);
  else
    unavailable(
      "coverageIntervals",
      "Run hypothetical experiments explicitly to compare procedures.",
    );
  value("coverageNaiveCount", naiveCount);
  value("coveragePairCount", pairCount);
  value("coverageEmptyCount", emptyCount);
  return {
    kind: "accepted",
    data: {
      outputs,
      stepIndex: CAMERA_GRID_STEPS,
      simulationTime: CAMERA_GRID_DT * CAMERA_GRID_STEPS,
    },
  };
}
