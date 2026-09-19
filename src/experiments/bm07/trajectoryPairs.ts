import type { ImportedTrajectory, TrajectoryPoint } from "./trajectoryCsv.ts";

export type TrajectoryFramePair = Readonly<{
  track: string;
  firstRow: number;
  secondRow: number;
}>;
export type TrajectoryPairReport = Readonly<{
  pairs: readonly TrajectoryFramePair[];
  unpairedRows: readonly number[];
  contributingTracks: number;
}>;
export type TrajectoryPairSelection =
  | Readonly<{
      kind: "selected";
      positions: Float64Array;
      report: TrajectoryPairReport;
    }>
  | Readonly<{ kind: "unavailable"; message: string }>;

/** Select (0,1), (2,3), ... separately in every admitted track.
 *
 * The CSV reader owns timing/calibration admission. This function changes
 * neither the observation ledger nor its order. Only complete frame pairs
 * are packed for the reference owner. In particular, an odd final frame
 * must NEVER be joined to the first frame of another particle. Interleaved
 * CSV tracks are supported without sorting, interpolation or relabelling.
 */
export function selectTrajectoryFramePairs(
  trajectory: ImportedTrajectory,
): TrajectoryPairSelection {
  const unavailable = (message: string): TrajectoryPairSelection => ({
    kind: "unavailable",
    message,
  });
  const d = trajectory.dimension;
  if (d !== 1 && d !== 2)
    return unavailable("The camera reference owner admits one or two coordinates, not three.");
  if (trajectory.dt === null || !Number.isFinite(trajectory.dt) || trajectory.dt <= 0)
    return unavailable(trajectory.timingIssue ?? "A common positive sampling interval is required.");
  // Separate bounded owner input; the public CSV reader is stricter still.
  if (trajectory.points.length * d > 20_000)
    return unavailable("The camera pairing request exceeds 20000 position coordinates.");

  const pending = new Map<string, TrajectoryPoint>();
  const last = new Map<string, TrajectoryPoint>();
  const usedRows = new Set<number>();
  const contributingTracks = new Set<string>();
  const positions: number[] = [];
  const pairs: TrajectoryFramePair[] = [];
  for (const point of trajectory.points) {
    if (
      typeof point.track !== "string" ||
      !Number.isSafeInteger(point.row) ||
      point.row < 1 ||
      usedRows.has(point.row) ||
      !Number.isFinite(point.time) ||
      point.coordinates.length !== d ||
      !point.coordinates.every(Number.isFinite)
    )
      return unavailable("The supplied observation ledger contains an invalid or repeated row.");
    usedRows.add(point.row);
    const previous = last.get(point.track);
    if (previous && point.time <= previous.time)
      return unavailable("Frame times must increase within each track; no rows are reordered.");
    last.set(point.track, point);
    const first = pending.get(point.track);
    if (!first) {
      pending.set(point.track, point);
      continue;
    }
    positions.push(...first.coordinates, ...point.coordinates);
    pairs.push(
      Object.freeze({ track: point.track, firstRow: first.row, secondRow: point.row }),
    );
    contributingTracks.add(point.track);
    pending.delete(point.track);
  }
  if (last.size !== trajectory.trackCount)
    return unavailable("The admitted track count does not match the supplied observation ledger.");
  if (pairs.length < 2)
    return unavailable("At least two disjoint frame pairs are needed to fit a common drift.");
  return Object.freeze({
    kind: "selected",
    positions: Float64Array.from(positions),
    report: Object.freeze({
      pairs: Object.freeze(pairs),
      unpairedRows: Object.freeze(Array.from(pending.values(), (point) => point.row)),
      contributingTracks: contributingTracks.size,
    }),
  });
}
