import { cameraCompatibleFamily } from "../../physics/reference/inference/identifiability.ts";
import { covarianceEstimator } from "../../physics/reference/inference/observation.ts";
import type { Assessment } from "../../physics/reference/inference.ts";
import {
  type ImportedTrajectory,
  type TrajectoryPoint,
  trajectorySpacingIssue,
} from "./trajectoryCsv.ts";

export type MomentRequest = Readonly<{
  axis: "x" | "y" | "z";
  knownDriftMPerS: number;
  exposureSeconds: number;
  modelDeclared: boolean;
  selection: "unknown" | "yes" | "no";
}>;
type TrackResult = Readonly<{
  track: string;
  sourceRows: readonly number[];
  dt: number | null;
}> &
  (
    | Readonly<{ kind: "unavailable"; reason: string }>
    | Readonly<{
        kind: "estimated";
        increments: number;
        neighboringPairs: number;
        variance: number;
        covariance: number;
        D: number;
        sigma2: number;
        status: "compatible" | "no-spread" | "outside-physical-range";
        spreadAlone: Readonly<{ maximumDiffusion: number; maximumNoiseVariance: number }> | null;
      }>
  );

function analyzeTrack(
  track: string,
  points: TrajectoryPoint[],
  request: MomentRequest,
  axis: number,
): TrackResult {
  const first = points[0],
    second = points[1];
  const dt = first && second ? second.time - first.time : null;
  const base = { track, dt, sourceRows: Object.freeze(points.map((p) => p.row)) };
  const unavailable = (reason: string): TrackResult => ({ ...base, kind: "unavailable", reason });
  if (dt === null || points.length < 4)
    return unavailable("Lag-one inference needs at least four positions from this track.");
  if (request.exposureSeconds > dt)
    return unavailable("The uniform exposure exceeds the sampling interval on this track.");
  const deltas = new Float64Array(points.length - 1);
  for (let i = 1; i < points.length; i++) {
    const p = points[i],
      prev = points[i - 1];
    if (!p || !prev) return unavailable("The accepted position ledger is incomplete.");
    const timing = trajectorySpacingIssue(prev.time, p.time, dt);
    if (timing) return unavailable(timing);
    const x = p.coordinates[axis],
      x0 = prev.coordinates[axis];
    if (x === undefined || x0 === undefined)
      return unavailable("The requested coordinate is absent.");
    deltas[i - 1] = x - x0;
  }
  const moments = covarianceEstimator(deltas, dt, {
    d: 1,
    exposure: request.exposureSeconds,
    knownDrift: request.knownDriftMPerS,
  });
  const reason = (answer: Exclude<Assessment<unknown>, { kind: "accepted" }>) =>
    answer.kind === "outcome"
      ? answer.outcome.message
      : answer.kind === "refused"
        ? answer.refusal.message
        : answer.reason;
  if (moments.kind !== "accepted") return unavailable(reason(moments));
  const { variance, covariance, D, sigma2 } = moments.data;
  const family =
    variance > 0
      ? cameraCompatibleFamily({ variance, dt, exposure: request.exposureSeconds })
      : null;
  if (family && family.kind !== "accepted") return unavailable(reason(family));
  return {
    ...base,
    kind: "estimated",
    increments: deltas.length,
    neighboringPairs: deltas.length - 1,
    variance,
    covariance,
    D,
    sigma2,
    status:
      variance === 0 ? "no-spread" : D < 0 || sigma2 < 0 ? "outside-physical-range" : "compatible",
    spreadAlone: family
      ? {
          maximumDiffusion: family.data.maximumDiffusion,
          maximumNoiseVariance: family.data.maximumNoiseVariance,
        }
      : null,
  };
}

export function analyzeTrajectoryMoments(trajectory: ImportedTrajectory, request: MomentRequest) {
  const base = {
    model: "camera-lag-one" as const,
    trajectory,
    assumptions: Object.freeze({ ...request }),
    sourceKind: "user-supplied-not-independently-verified" as const,
    calculation: "reference-host" as const,
    interval: null,
  };
  const unavailable = (message: string) => ({
    ...base,
    kind: "unavailable" as const,
    tracks: [] as readonly TrackResult[],
    message,
  });
  if (!request.modelDeclared || request.selection !== "no")
    return unavailable(
      "Declare uniform exposure, independent position errors, independently known drift and unselected observations before estimating the two camera moments.",
    );
  const axis = ["x", "y", "z"].indexOf(request.axis);
  if (axis < 0 || axis >= trajectory.dimension)
    return unavailable("Choose a coordinate present in this recording.");
  if (
    !Number.isFinite(request.knownDriftMPerS) ||
    !Number.isFinite(request.exposureSeconds) ||
    request.exposureSeconds < 0
  )
    return unavailable("Declare a finite known drift and a nonnegative exposure time.");
  const grouped = new Map<string, TrajectoryPoint[]>();
  for (const point of trajectory.points) {
    const existing = grouped.get(point.track);
    if (existing) existing.push(point);
    else grouped.set(point.track, [point]);
  }
  const tracks = Array.from(grouped, ([id, points]) => analyzeTrack(id, points, request, axis));
  const resolved = tracks.some((track) => track.kind === "estimated");
  return {
    ...base,
    kind: resolved ? ("analyzed" as const) : ("unavailable" as const),
    tracks,
    message: resolved
      ? "Each track uses its own neighboring increments along the selected coordinate. These are finite-sample moment estimates. This procedure supplies no confidence interval."
      : "No track meets the timing and observation requirements for a lag-one estimate. See the reason alongside each track.",
  };
}

export type MomentAnalysis = ReturnType<typeof analyzeTrajectoryMoments>;
