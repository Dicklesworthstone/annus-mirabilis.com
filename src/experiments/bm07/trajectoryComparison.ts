import type { StatisticalInterval } from "../../physics/reference/inference.ts";
import type { TrajectoryAnalysis } from "./trajectoryAnalysis.ts";
import { isCameraTrajectoryAnalysis } from "./trajectoryCamera.ts";
import type { ImportedTrajectory } from "./trajectoryCsv.ts";
import { trajectoryTrackIds } from "./trajectoryInspection.ts";
import type { MomentAnalysis } from "./trajectoryMoments.ts";

export type AcceptedMeasuredAnalysis = Readonly<{
  analysis: TrajectoryAnalysis | MomentAnalysis;
  source: string;
  run: number;
}>;
export function isMomentAnalysis(
  analysis: AcceptedMeasuredAnalysis["analysis"],
): analysis is MomentAnalysis {
  return "model" in analysis && analysis.model === "camera-lag-one";
}

/** Compare the accepted measured ledger, never a filename, a display precision or fitted parameters.
 * CSV row numbers are source addresses. A change in blank lines alone cannot change the observations.
 * All axes and times have already been calibrated to SI by the same CSV owner.
 */
export function observationDifference(
  first: ImportedTrajectory,
  second: ImportedTrajectory,
): string | null {
  if (first.dimension !== second.dimension)
    return "The two records have different coordinate axes.";
  if (first.points.length !== second.points.length)
    return "The records have different numbers of measured positions.";
  for (const [index, a] of first.points.entries()) {
    const b = second.points[index];
    if (!b || a.track !== b.track)
      return `Track identity or track order differs at observation ${index + 1}.`;
    if (a.time !== b.time)
      return `Elapsed time in seconds differs at observation ${index + 1} of the record.`;
    if (!a.coordinates.every((value, axis) => value === b.coordinates[axis]))
      return `A calibrated position in metres differs at observation ${index + 1} of the record.`;
  }
  return null;
}

type Summary = Readonly<{
  model: string;
  tracks: readonly string[];
  axes: readonly string[];
  sample: string;
  estimate: number | null;
  usable: boolean;
  interval: StatisticalInterval | null;
  intervalNote: string;
  limits: string;
}>;
const estimatorNames = {
  "drift-centered": "Fit drift, unbiased spread",
  "maximum-likelihood-centered": "Fit drift, maximum likelihood",
  "independent-increment-known-zero-drift": "Independently known zero drift",
};

export function summarizeMeasuredAnalysis(
  analysis: AcceptedMeasuredAnalysis["analysis"],
  track: string,
): Summary {
  if (isMomentAnalysis(analysis)) {
    const selected = analysis.tracks.find((item) => item.track === track);
    const estimate = selected?.kind === "estimated" ? selected : null;
    return {
      model: "Camera lag-one covariance",
      tracks: [track],
      axes: [analysis.assumptions.axis],
      sample: estimate
        ? `${estimate.increments} displacements, ${estimate.neighboringPairs} neighboring pairs`
        : "No admitted sample",
      estimate: estimate?.D ?? null,
      usable: estimate?.status === "compatible" && estimate.D > 0,
      interval: null,
      intervalNote: "The moment estimator supplies point estimates only.",
      limits: estimate
        ? estimate.status === "outside-physical-range"
          ? "A signed moment estimate lies outside the physical range."
          : estimate.status === "no-spread"
            ? "No spread resolved."
            : "The model uses the independently supplied drift and exposure."
        : selected?.kind === "unavailable"
          ? selected.reason
          : analysis.message,
    };
  }
  const axes = ["x", "y", "z"].slice(0, analysis.trajectory.dimension);
  if (isCameraTrajectoryAnalysis(analysis)) {
    const camera = analysis.camera;
    return {
      model: "Camera disjoint pairs, fitted drift",
      axes,
      tracks: Array.from(new Set(analysis.pairing?.pairs.map((pair) => pair.track) ?? [])),
      sample: camera
        ? `${camera.pairs} disjoint frame pairs, ${camera.q} degrees of freedom`
        : "No admitted sample",
      estimate: camera?.estimate ?? null,
      usable: Boolean(camera && !camera.empty && camera.estimate > 0),
      interval: camera?.interval ?? null,
      intervalNote: camera?.empty
        ? "Empty physical confidence set."
        : "No admitted diffusion confidence set.",
      limits: analysis.message,
    };
  }
  return {
    model: `Ideal increments · ${estimatorNames[analysis.assumptions.estimator]}`,
    axes,
    tracks: trajectoryTrackIds(analysis.trajectory),
    sample: analysis.estimate
      ? `${analysis.estimate.M} adjacent displacements, ${analysis.estimate.q} degrees of freedom`
      : "No admitted sample",
    estimate: analysis.estimate?.dHat ?? null,
    usable: Boolean(analysis.estimate && analysis.estimate.dHat > 0),
    interval: analysis.interval,
    intervalNote: "No admitted diffusion interval.",
    limits: analysis.message,
  };
}

export function compareMeasuredScope(first: Summary, second: Summary) {
  if (
    first.tracks.length !== second.tracks.length ||
    first.tracks.some((id) => !second.tracks.includes(id)) ||
    first.axes.length !== second.axes.length ||
    first.axes.some((axis) => !second.axes.includes(axis))
  )
    return { kind: "different-scope" as const };
  if (!first.usable || !second.usable || first.estimate === null || second.estimate === null)
    return { kind: "unavailable" as const };
  return { kind: "comparable" as const, difference: second.estimate - first.estimate };
}
