import type { ImportedTrajectory, TrajectoryPoint } from "./trajectoryCsv.ts";

/** Presentation-only views over accepted positions, never an estimator or a
 * resampling step. Paging the table cannot change what entered the inference. */
export const TRAJECTORY_PAGE_SIZE = 25;
export type InspectionPoint = Readonly<{
  source: TrajectoryPoint;
  horizontal: number;
  vertical: number;
}>;
export type TrajectoryInspection = Readonly<{
  track: string;
  coordinate: number;
  page: number;
  pages: number;
  total: number;
  start: number;
  end: number;
  timeRange: readonly [number, number];
  coordinateRange: readonly [number, number];
  points: readonly InspectionPoint[];
}>;
export function trajectoryTrackIds(trajectory: ImportedTrajectory): readonly string[] {
  return Object.freeze([...new Set(trajectory.points.map((point) => point.track))]);
}

function bounds(values: readonly number[]): readonly [number, number] {
  let lower = Infinity,
    upper = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new RangeError("An inspection coordinate must be finite.");
    lower = Math.min(lower, value);
    upper = Math.max(upper, value);
  }
  return Object.freeze([lower, upper]);
}
/** Avoid an overflowing high-low span without losing subnormal finite spans. */
function fraction(value: number, [lower, upper]: readonly [number, number]): number {
  if (lower === upper) return 0.5;
  const span = upper - lower;
  return Number.isFinite(span)
    ? (value - lower) / span
    : (value / 2 - lower / 2) / (upper / 2 - lower / 2);
}
export function inspectTrajectory(
  trajectory: ImportedTrajectory,
  track: string,
  coordinate: number,
  page: number,
): TrajectoryInspection {
  if (!Number.isSafeInteger(coordinate) || coordinate < 0 || coordinate >= trajectory.dimension)
    throw new RangeError("Choose a coordinate present in this recording.");
  const accepted = trajectory.points.filter((point) => point.track === track);
  if (accepted.length === 0) throw new RangeError("Choose a track present in this recording.");
  const pages = Math.ceil(accepted.length / TRAJECTORY_PAGE_SIZE);
  if (!Number.isSafeInteger(page) || page < 1 || page > pages)
    throw new RangeError("Choose an available inspection page.");
  // Domains cover the whole selected track and stay fixed while paging.
  const timeRange = bounds(accepted.map((point) => point.time));
  const coordinateRange = bounds(accepted.map((point) => point.coordinates[coordinate] ?? 0));
  const start = (page - 1) * TRAJECTORY_PAGE_SIZE;
  const points = accepted.slice(start, start + TRAJECTORY_PAGE_SIZE).map((source) =>
    Object.freeze({
      source,
      horizontal: fraction(source.time, timeRange),
      vertical: fraction(source.coordinates[coordinate] ?? 0, coordinateRange),
    }),
  );
  return Object.freeze({
    track,
    coordinate,
    page,
    pages,
    total: accepted.length,
    start: start + 1,
    end: start + points.length,
    timeRange,
    coordinateRange,
    points: Object.freeze(points),
  });
}
