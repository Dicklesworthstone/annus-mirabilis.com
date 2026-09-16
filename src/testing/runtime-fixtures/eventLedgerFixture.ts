/**
 * Event-ledger runtime fixture (am-rt-command-classes-dzp).
 *
 * "a handful of identified events and two worldlines, described in a frame selected by a
 * signed speed v/c in (-1, 1) with the exact aligned boost x' = gamma(x - vt), t' = gamma(t - vx/c^2)"
 */
import { eventSetDigest, worldlineDigest } from "../../experiments/digest/scientificDigest.ts";

export type SpacetimeEvent = Readonly<{
  id: string;
  t: number;
  x: number;
  y: number;
  z: number;
}>;

export type WorldlineSegment = Readonly<{
  id: string;
  eventStartId: string;
  eventEndId: string;
  properIntervalSq: number;
}>;

export type EventLedgerDescription = Readonly<{
  frameSpeedVc: number;
  events: readonly SpacetimeEvent[];
  worldlines: readonly WorldlineSegment[];
  eventSetDigest: string;
  worldlineDigest: string;
}>;

const BASE_EVENTS: readonly SpacetimeEvent[] = Object.freeze([
  { id: "event-origin-emission", t: 0.0, x: 0.0, y: 0.0, z: 0.0 },
  { id: "event-sensor-trigger", t: 1.0, x: 0.5, y: 0.0, z: 0.0 },
  { id: "event-absorber-impact", t: 2.0, x: 0.8, y: 0.0, z: 0.0 },
  { id: "event-echo-detection", t: 3.0, x: 0.2, y: 0.0, z: 0.0 },
]);

const BASE_WORLDLINES: readonly WorldlineSegment[] = Object.freeze([
  {
    id: "worldline-emitter",
    eventStartId: "event-origin-emission",
    eventEndId: "event-echo-detection",
    properIntervalSq: 3.0 ** 2 - 0.2 ** 2,
  },
  {
    id: "worldline-signal",
    eventStartId: "event-origin-emission",
    eventEndId: "event-sensor-trigger",
    properIntervalSq: 1.0 ** 2 - 0.5 ** 2,
  },
]);

/**
 * Applies Lorentz boost along x-axis with c = 1.
 * x' = gamma * (x - v*t)
 * t' = gamma * (t - v*x)
 */
export function lorentzBoost(event: SpacetimeEvent, vOverC: number): SpacetimeEvent {
  if (Math.abs(vOverC) >= 1.0) {
    throw new RangeError("v/c must be strictly within (-1, 1)");
  }
  const gamma = 1.0 / Math.sqrt(1.0 - vOverC * vOverC);
  const tPrime = gamma * (event.t - vOverC * event.x);
  const xPrime = gamma * (event.x - vOverC * event.t);
  return Object.freeze({
    id: event.id,
    t: tPrime,
    x: xPrime,
    y: event.y,
    z: event.z,
  });
}

/**
 * Computes invariant digests for events and worldlines.
 * Since the events are physical events and worldlines are physical worldlines,
 * their identities and rest-frame invariants form their canonical invariant digest.
 */
export async function computeLedgerDigests(): Promise<{
  eventSetDigest: string;
  worldlineDigest: string;
}> {
  const eventDigestObj = await eventSetDigest({
    events: BASE_EVENTS.map((e) => ({
      id: e.id,
      t: e.t,
      x: e.x,
      y: e.y,
      z: e.z,
    })),
  });

  const worldlineDigestObj = await worldlineDigest({
    worldlines: BASE_WORLDLINES.map((w) => ({
      id: w.id,
      eventStartId: w.eventStartId,
      eventEndId: w.eventEndId,
      properIntervalSq: w.properIntervalSq,
    })),
  });

  return {
    eventSetDigest: eventDigestObj.digest,
    worldlineDigest: worldlineDigestObj.digest,
  };
}

/**
 * Generates an event ledger description in a coordinate frame moving at v/c.
 */
export async function createEventLedgerDescription(
  vOverC: number,
): Promise<EventLedgerDescription> {
  const boostedEvents = BASE_EVENTS.map((e) => lorentzBoost(e, vOverC));
  const digests = await computeLedgerDigests();

  return Object.freeze({
    frameSpeedVc: vOverC,
    events: Object.freeze(boostedEvents),
    worldlines: BASE_WORLDLINES,
    eventSetDigest: digests.eventSetDigest,
    worldlineDigest: digests.worldlineDigest,
  });
}
