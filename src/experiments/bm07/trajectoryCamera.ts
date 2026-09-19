/** Imported camera observations, not synthetic recovery or a 1905 experiment.
 * The existing observation reference owner owns every estimate and interval.
 * This module admits declarations, selects disjoint pairs within tracks,
 * and preserves the same accepted observations in the display and export.
 */
import type * as Observation from "../../physics/reference/inference/observation.ts";
import type { TrajectoryAnalysis, TrajectoryAssumptions } from "./trajectoryAnalysis.ts";
import type { ImportedTrajectory } from "./trajectoryCsv.ts";
import { selectTrajectoryFramePairs, type TrajectoryPairReport } from "./trajectoryPairs.ts";

export type CameraTrajectoryReference = Pick<
  typeof Observation,
  "disjointPairsKnownNoiseInterval"
>;
type CameraExecutionOutcome = Extract<
  ReturnType<CameraTrajectoryReference["disjointPairsKnownNoiseInterval"]>,
  { kind: "outcome" }
>["outcome"];
export type CameraTrajectoryAnalysis = TrajectoryAnalysis &
  Readonly<{
    model: "camera-disjoint-pairs";
    cameraModelDeclared: boolean;
    pairing: TrajectoryPairReport | null;
    camera: Observation.PairInterval | null;
    ownerOutcome: CameraExecutionOutcome | null;
  }>;

export function isCameraTrajectoryAnalysis(
  analysis: TrajectoryAnalysis,
): analysis is CameraTrajectoryAnalysis {
  return "model" in analysis && analysis.model === "camera-disjoint-pairs";
}

export function analyzeCameraTrajectory(
  trajectory: ImportedTrajectory,
  input: TrajectoryAssumptions,
  cameraModelDeclared: boolean,
  reference: CameraTrajectoryReference,
): CameraTrajectoryAnalysis {
  const assumptions = Object.freeze({
    ...input,
    independentRadius: input.independentRadius
      ? Object.freeze({ ...input.independentRadius })
      : null,
  });
  const base = {
    trajectory,
    assumptions,
    model: "camera-disjoint-pairs" as const,
    cameraModelDeclared: cameraModelDeclared === true,
    calculation: "reference-host" as const,
    sourceKind: "user-supplied-not-independently-verified" as const,
    // These are not independent-increment estimates. Do not fabricate an
    // Estimate or route a possibly zero-crossing interval through 1 / D.
    estimate: null,
    molecular: null,
    ownerOutcome: null,
    molecularMessage:
      "No molecular-number inversion is performed for camera data. A physical confidence set may reach zero or be empty; neither warrants an infinite molecular number.",
  };
  const unavailable = (
    message: string,
    pairing: TrajectoryPairReport | null = null,
    ownerOutcome: CameraExecutionOutcome | null = null,
  ): CameraTrajectoryAnalysis =>
    Object.freeze({
      ...base,
      kind: "unavailable",
      interval: null,
      pairing,
      camera: null,
      ownerOutcome: ownerOutcome ? Object.freeze({ ...ownerOutcome }) : null,
      message,
    });
  if (
    !Number.isFinite(assumptions.coverage) ||
    assumptions.coverage < 0.5 ||
    assumptions.coverage > 0.999
  )
    throw new Error("Choose interval coverage from 50% through 99.9%.");
  if (cameraModelDeclared !== true)
    return unavailable(
      "Declare isotropic Brownian motion with constant drift, independent particles, uniform exposure, and independent Gaussian localization errors with one common exactly known noise scale. The CSV cannot establish this camera model.",
    );
  if (trajectory.trackCount > 1 && assumptions.commonDriftAndDiffusion !== true)
    return unavailable(
      "Pooling camera tracks requires an explicitly common drift and diffusion coefficient. Different particles are not automatically interchangeable.",
    );
  if (assumptions.censored !== false)
    return unavailable(
      "Selection, censoring and motion filtering must be explicitly absent. This camera procedure does not correct selection bias.",
    );
  const sigma = assumptions.localizationStd;
  const exposure = assumptions.exposureTime;
  if (sigma === null || exposure === null)
    return unavailable(
      "Declare the localization standard deviation and exposure. Unknown noise is not zero; this procedure conditions on an independently known noise scale.",
    );
  const sigma2 = sigma * sigma;
  if (
    !Number.isFinite(sigma) ||
    sigma < 0 ||
    !Number.isFinite(sigma2) ||
    (sigma > 0 && sigma2 === 0) ||
    !Number.isFinite(exposure) ||
    exposure < 0
  )
    return unavailable("The camera noise or exposure cannot be represented at this numerical scale.");
  const selected = selectTrajectoryFramePairs(trajectory);
  if (selected.kind === "unavailable") return unavailable(selected.message);
  // The selector has admitted dt; the guard also preserves static narrowing.
  if (trajectory.dt === null || exposure > trajectory.dt)
    return unavailable(
      "Uniform exposure must not exceed the admitted frame spacing. Overlapping exposures need another observation model.",
      selected.report,
    );
  const evaluated = reference.disjointPairsKnownNoiseInterval({
    positions: selected.positions,
    dt: trajectory.dt,
    exposure,
    d: trajectory.dimension,
    alpha: 1 - assumptions.coverage,
    noise: { kind: "exact", sigma2 },
    equalSpacing: true,
    independentNoise: true,
  });
  if (evaluated.kind === "outcome")
    return unavailable(
      "The camera reference owner reported an execution outcome instead of an estimate. No interval is supplied; the accepted JSON retains the owner's diagnostic.",
      selected.report,
      evaluated.outcome,
    );
  if (evaluated.kind !== "accepted")
    return unavailable(
      evaluated.kind === "refused" ? evaluated.refusal.message : evaluated.reason,
      selected.report,
    );
  const camera = Object.freeze({
    ...evaluated.data,
    interval: evaluated.data.interval ? Object.freeze({ ...evaluated.data.interval }) : null,
    noiseInterval: Object.freeze([...evaluated.data.noiseInterval]) as readonly [number, number],
  });
  const explanation = camera.empty
    ? "The physical diffusion confidence set is empty under the declared camera model. This is retained as a model/data diagnostic, not replaced by zero or a positive interval."
    : camera.lowerClipped
      ? "The noise-corrected confidence set reaches the physical boundary D = 0. Its lower endpoint is restricted to that boundary; the point estimate is not clipped."
      : "Conditional noise-corrected diffusion interval using disjoint frame pairs and a fitted common drift.";
  return Object.freeze({
    ...base,
    kind: "analyzed",
    interval: camera.interval,
    pairing: selected.report,
    camera,
    message: `${explanation} The localization noise scale, exposure, timing and spatial calibration are held exact. Their uncertainty, confinement, non-Gaussian errors and model mismatch are not included.`,
  });
}

/** Versioned, local export of the accepted model, pair selection and ALL
 * observations. Omitted final frames remain in the observation ledger.
 * Refuse nonfinite output rather than silently serializing it as null.
 */
export function cameraTrajectoryAnalysisJson(analysis: CameraTrajectoryAnalysis): string {
  return `${JSON.stringify(
    {
      schema: "annus-mirabilis-camera-trajectory-analysis",
      version: 1,
      ...analysis,
      outputUnits: {
        time: "s",
        position: "m",
        diffusion: "m^2/s",
        localizationVariance: "m^2",
      },
      observationNotice:
        "User-supplied observations, not independently verified. Pair row numbers refer to the original CSV; all imported positions are retained.",
    },
    (_key, value: unknown) => {
      if (typeof value === "number" && !Number.isFinite(value))
        throw new Error("An accepted camera analysis contains a nonfinite value; export refused.");
      return value;
    },
    2,
  )}\n`;
}
