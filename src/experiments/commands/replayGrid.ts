/**
 * The replay grid (am-rt-command-classes-dzp requirement 7): each stochastic experiment
 * declares a base spacing and a stored horizon. Observation cadence subsamples an existing
 * fixed logical path -- it never re-simulates at a new cadence, which would consume a
 * different random stream and break comparisons. Supported observation intervals are
 * positive integer multiples of the base spacing within the horizon; anything else is a
 * request refusal (`off-replay-grid`), never a silently resampled path.
 */
import { makeRefusal, type RequestRefusal } from "../results/refusals.ts";

export type ReplayGrid = Readonly<{
  /** Seconds between adjacent stored samples on the logical path. */
  baseSpacingSeconds: number;
  /** The longest interval the stored path can be subsampled at, in seconds. */
  storedHorizonSeconds: number;
}>;

export type ReplayGridDecision =
  | Readonly<{ accepted: true }>
  | Readonly<{ accepted: false; refusal: RequestRefusal }>;

function assertGrid(grid: ReplayGrid): void {
  if (
    !Number.isFinite(grid.baseSpacingSeconds) ||
    grid.baseSpacingSeconds <= 0 ||
    !Number.isFinite(grid.storedHorizonSeconds) ||
    grid.storedHorizonSeconds < grid.baseSpacingSeconds
  )
    throw new TypeError("A replay grid needs a positive base spacing at or below its horizon.");
}

/** The multiplier k for the nearest supported interval `k * baseSpacing`, clamped to the
 * grid's [1, floor(horizon/baseSpacing)] range of admitted multiples. */
function nearestSupportedMultiple(grid: ReplayGrid, requestedSeconds: number): number {
  const maxK = Math.floor(grid.storedHorizonSeconds / grid.baseSpacingSeconds);
  const raw = requestedSeconds / grid.baseSpacingSeconds;
  const rounded = Math.round(raw);
  return Math.min(Math.max(rounded, 1), maxK);
}

function isSupportedInterval(grid: ReplayGrid, requestedSeconds: number): boolean {
  if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) return false;
  if (requestedSeconds > grid.storedHorizonSeconds + 1e-12) return false;
  const ratio = requestedSeconds / grid.baseSpacingSeconds;
  const rounded = Math.round(ratio);
  return rounded >= 1 && Math.abs(ratio - rounded) < 1e-9;
}

/**
 * Decides whether `requestedIntervalSeconds` is on the grid. A refusal names the parameter
 * (`parameterId`) and ranks the nearest supported intervals below and above the request --
 * only those that actually exist on the grid (a request below the base spacing has no
 * "below" repair; a request past the horizon's last supported multiple has no "above" repair).
 */
export function checkObservationInterval(
  grid: ReplayGrid,
  requestedIntervalSeconds: number,
  parameterId: string,
): ReplayGridDecision {
  assertGrid(grid);
  if (isSupportedInterval(grid, requestedIntervalSeconds)) return { accepted: true };

  const maxK = Math.floor(grid.storedHorizonSeconds / grid.baseSpacingSeconds);
  const nearestK = nearestSupportedMultiple(grid, requestedIntervalSeconds);
  const ratio = requestedIntervalSeconds / grid.baseSpacingSeconds;
  const belowK = Number.isFinite(ratio) ? Math.max(1, Math.min(Math.floor(ratio + 1e-9), maxK)) : 1;
  const aboveK = Number.isFinite(ratio)
    ? Math.max(1, Math.min(Math.ceil(ratio - 1e-9), maxK))
    : maxK;
  const hasBelow =
    Number.isFinite(ratio) &&
    ratio > 1 &&
    belowK >= 1 &&
    belowK * grid.baseSpacingSeconds < requestedIntervalSeconds - 1e-12;
  const hasAbove =
    Number.isFinite(ratio) &&
    aboveK <= maxK &&
    aboveK * grid.baseSpacingSeconds > requestedIntervalSeconds + 1e-12;

  const rankedRepairs: Array<{ label: string; action: { parameterId: string; value: number } }> =
    [];
  if (hasBelow) {
    const value = belowK * grid.baseSpacingSeconds;
    rankedRepairs.push({
      label: `Use ${value} s (the nearest supported interval below)`,
      action: { parameterId, value },
    });
  }
  if (hasAbove) {
    const value = aboveK * grid.baseSpacingSeconds;
    rankedRepairs.push({
      label: `Use ${value} s (the nearest supported interval above)`,
      action: { parameterId, value },
    });
  }
  if (rankedRepairs.length === 0) {
    // Every finite value has a nearest multiple somewhere in [1, maxK]; this is unreachable
    // for a well-formed grid, but a request refusal must never ship with zero repairs.
    const value = nearestK * grid.baseSpacingSeconds;
    rankedRepairs.push({
      label: `Use ${value} s (the nearest supported interval)`,
      action: { parameterId, value },
    });
  }

  return {
    accepted: false,
    refusal: makeRefusal(
      "off-replay-grid",
      { parameterIds: [parameterId] },
      {
        rankedRepairs,
        details: {
          requestedIntervalSeconds,
          baseSpacingSeconds: grid.baseSpacingSeconds,
          storedHorizonSeconds: grid.storedHorizonSeconds,
        },
      },
    ),
  };
}
