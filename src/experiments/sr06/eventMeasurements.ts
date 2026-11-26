import { alignedBoost, transformEvent } from "../../physics/reference/kinematics.ts";
import type { Event } from "../../physics/reference/kinematics/types.ts";

/**
 * A is the shared origin. B ends after one second of k time, C after one second of K time.
 * Coordinates use seconds and light-seconds, so each spatial slope is the corresponding u/c.
 */
export function measureVelocityFromEvents(frameBeta: number, wx: number, wy: number) {
  const toStationary = alignedBoost(-frameBeta, 1);
  if (toStationary.status !== "value") return toStationary;

  const inMoving = (t: number): Event => ({ t, x: wx * t, y: wy * t, z: 0 });
  const movingB = inMoving(1);
  const stationaryB = transformEvent(movingB, toStationary.value);
  if (stationaryB.status !== "value") return stationaryB;

  // On a uniform worldline the Lorentz map is linear in the elapsed coordinate time.
  const movingC = inMoving(1 / stationaryB.value.t);
  const stationaryC = transformEvent(movingC, toStationary.value);
  if (stationaryC.status !== "value") return stationaryC;

  const moving = [movingB, movingC];
  const stationary = [stationaryB.value, stationaryC.value];
  const series = (pair: Event[], read: (event: Event) => number) => Float64Array.from(pair, read);
  return {
    status: "value" as const,
    value: {
      eventTimeMoving: series(moving, e => e.t),
      eventTimeStationary: series(stationary, e => e.t),
      eventXMoving: series(moving, e => e.x),
      eventXStationary: series(stationary, e => e.x),
      eventYMoving: series(moving, e => e.y),
      eventYStationary: series(stationary, e => e.y),
      eventSlopeXMoving: series(moving, e => e.x / e.t),
      eventSlopeXStationary: series(stationary, e => e.x / e.t),
      eventSlopeYMoving: series(moving, e => e.y / e.t),
      eventSlopeYStationary: series(stationary, e => e.y / e.t),
    },
  };
}
