/**
 * Event-ledger and simultaneity reference physics owner for SR-01 (am-sr-01-clock-sync-jbfn)
 * and SR-03 (am-sr-03-rod-simultaneity-0l5i).
 *
 * Natural units throughout: distance in light-seconds, time in seconds, c = 1.0 ls/s.
 */

import {
  alignedBoost,
  desynchronization as kinematicDesynchronization,
  gamma as computeGamma,
  transformEvent,
} from "./kinematics.ts";
import {
  type Boost,
  type Event,
  type KinematicResult,
  ok,
  outsideDomain,
} from "./kinematics/types.ts";

/** c = 1 light-second per second by construction of this module's natural unit system. */
const C = 1.0;

export type ClockId = string;
export type EventKind = "emission" | "reflection" | "reception";

export type LedgerEvent = Readonly<{
  id: string;
  kind: EventKind;
  clockId: ClockId;
  /** Invariant under `redescribe`: what that specific clock displayed. */
  ownClockReading: number;
  /** Frame-dependent; only this field changes under `redescribe`. */
  coordinates: Event;
}>;

export interface LedgerEventItem {
  readonly id: string;
  readonly frame: string;
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly label?: string;
}

export interface Ledger {
  readonly runId: string;
  readonly frame: string;
  readonly events: readonly LedgerEventItem[];
}

function finite(...values: readonly number[]): boolean {
  return values.every(Number.isFinite);
}

function refuseSuperluminal(beta: number): KinematicResult<never> | null {
  if (!Number.isFinite(beta))
    return outsideDomain("nonfinite-beta", "beta must be a finite number.");
  if (Math.abs(beta) >= 1) {
    return outsideDomain(
      "superluminal-observer",
      "No inertial observer moves at or above light speed (|v| < c is the admissible domain).",
    );
  }
  return null;
}

function refuseSeparation(separationLs: number): KinematicResult<never> | null {
  if (!Number.isFinite(separationLs) || separationLs <= 0) {
    return outsideDomain(
      "invalid-length",
      "Station separation must be a finite, positive number of light-seconds.",
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// checkClockSynchronization & receptionTime
// ---------------------------------------------------------------------------

export interface ClockSyncResult {
  readonly synchronized: boolean;
  readonly expectedTB: number;
  readonly discrepancy: number;
}

export function checkClockSynchronization(
  tA: number,
  tB: number,
  tPrimeA: number,
  _c = C,
): KinematicResult<ClockSyncResult> {
  if (!finite(tA, tB, tPrimeA)) {
    return outsideDomain("nonfinite-input", "Clock readings must be finite.");
  }
  if (tPrimeA <= tA) {
    return outsideDomain("invalid-round-trip", "t'_A must be strictly greater than t_A.");
  }
  const expectedTB = (tA + tPrimeA) / 2;
  const discrepancy = Math.abs(tB - expectedTB);
  return ok({
    synchronized: discrepancy === 0,
    expectedTB,
    discrepancy,
  });
}

export function receptionTime(
  emissionTimeS: number,
  emissionXLs: number,
  receiverXLs: number,
): KinematicResult<number> {
  if (!finite(emissionTimeS, emissionXLs, receiverXLs)) {
    return outsideDomain("nonfinite-input", "Emission time and positions must be finite.");
  }
  const distanceLs = Math.abs(receiverXLs - emissionXLs);
  return ok(emissionTimeS + distanceLs / C);
}

// ---------------------------------------------------------------------------
// synchronizationRound & synchronizationTransitivity
// ---------------------------------------------------------------------------

export interface SynchronizationRoundInput {
  readonly emissionTimeA: number;
  readonly receptionTimeA: number;
  readonly separationLs: number;
}

export interface SynchronizationRoundResult {
  readonly assignedRemoteTime: number;
  readonly roundTripSpeedLsPerS: number;
  readonly equalsC: boolean;
  readonly criterionOffset: number;
}

export function synchronizationRound(
  input: SynchronizationRoundInput,
): KinematicResult<SynchronizationRoundResult> {
  const { emissionTimeA, receptionTimeA, separationLs } = input;
  if (!finite(emissionTimeA, receptionTimeA)) {
    return outsideDomain("nonfinite-input", "Emission and reception times must be finite.");
  }
  if (receptionTimeA <= emissionTimeA) {
    return outsideDomain(
      "invalid-round-trip",
      "A round trip's reception must occur strictly after its emission.",
    );
  }
  const badSeparation = refuseSeparation(separationLs);
  if (badSeparation) return badSeparation;

  const assignedRemoteTime = (emissionTimeA + receptionTimeA) / 2;
  const roundTripSpeedLsPerS = (2 * separationLs) / (receptionTimeA - emissionTimeA);
  const criterionOffset =
    assignedRemoteTime - emissionTimeA - (receptionTimeA - assignedRemoteTime);
  return ok({
    assignedRemoteTime,
    roundTripSpeedLsPerS,
    equalsC: Math.abs(roundTripSpeedLsPerS - C) <= 1e-9,
    criterionOffset,
  });
}

export interface StationPairVelocity {
  readonly stationA: ClockId;
  readonly stationB: ClockId;
  readonly relativeVelocityBeta: number;
}

export type TransitivityResult =
  | Readonly<{ status: "transitive"; stations: readonly ClockId[] }>
  | Readonly<{ status: "not-applicable"; reason: string }>;

export function synchronizationTransitivity(
  pairs: readonly StationPairVelocity[],
): KinematicResult<TransitivityResult> {
  if (pairs.length === 0) {
    return outsideDomain("empty-input", "At least one station pair is required.");
  }
  for (const pair of pairs) {
    if (!finite(pair.relativeVelocityBeta)) {
      return outsideDomain("nonfinite-input", "Each pair's relative velocity must be finite.");
    }
    const bad = refuseSuperluminal(pair.relativeVelocityBeta);
    if (bad) return bad;
  }
  const stations: ClockId[] = [];
  for (const pair of pairs) {
    if (!stations.includes(pair.stationA)) stations.push(pair.stationA);
    if (!stations.includes(pair.stationB)) stations.push(pair.stationB);
  }
  const allAtRest = pairs.every((pair) => pair.relativeVelocityBeta === 0);
  if (!allAtRest) {
    return ok({
      status: "not-applicable",
      reason:
        "Stations in relative motion do not share one synchronization procedure; transitivity is not evaluated across frames.",
    });
  }
  return ok({ status: "transitive", stations: Object.freeze(stations) });
}

// ---------------------------------------------------------------------------
// movingRodLegs & movingRodLightLegs
// ---------------------------------------------------------------------------

export interface MovingRodLegsInput {
  readonly separationLs: number;
  readonly beta: number;
}

export interface MovingRodLegsResult {
  readonly outboundLegS: number;
  readonly returnLegS: number;
  readonly criterionSatisfiedInStationaryFrame: boolean;
}

export function movingRodLegs(input: MovingRodLegsInput): KinematicResult<MovingRodLegsResult> {
  const { separationLs, beta } = input;
  const badSeparation = refuseSeparation(separationLs);
  if (badSeparation) return badSeparation;
  const bad = refuseSuperluminal(beta);
  if (bad) return bad;
  const outboundLegS = separationLs / (C - beta);
  const returnLegS = separationLs / (C + beta);
  return ok({
    outboundLegS,
    returnLegS,
    criterionSatisfiedInStationaryFrame: beta === 0,
  });
}

export interface MovingRodLightLegsResult {
  readonly t1Forward: number;
  readonly t2Return: number;
  readonly tRoundTrip: number;
  readonly tRoundTripRest: number;
  readonly desynchronization: number;
}

export function movingRodLightLegs(
  L: number,
  v: number,
  c = C,
): KinematicResult<MovingRodLightLegsResult> {
  if (!finite(L, v, c) || L <= 0 || c <= 0) {
    return outsideDomain("outside-domain", "Length and speed of light must be positive numbers.");
  }
  const bad = refuseSuperluminal(v / c);
  if (bad) return bad;

  const t1Forward = L / (c - v);
  const t2Return = L / (c + v);
  const tRoundTrip = t1Forward + t2Return;
  const tRoundTripRest = (2 * L) / c;
  const desynchronization = (v * L) / (c * c);

  return ok({
    t1Forward,
    t2Return,
    tRoundTrip,
    tRoundTripRest,
    desynchronization,
  });
}

// ---------------------------------------------------------------------------
// classifySimultaneity
// ---------------------------------------------------------------------------

export type SimultaneityVerdict = "before" | "simultaneous" | "after" | "indeterminate";
export type SimultaneityOrder =
  | "simultaneous"
  | "ordered-positive"
  | "ordered-negative"
  | "indeterminate";

export function classifySimultaneity(
  deltaT: number,
  tolerance?: { absolute?: number },
): SimultaneityOrder;
export function classifySimultaneity(
  timeA: number,
  timeB: number,
  toleranceAbsoluteS?: number,
): KinematicResult<SimultaneityVerdict>;
export function classifySimultaneity(
  a: number,
  b?: number | { absolute?: number },
  c?: number,
): SimultaneityOrder | KinematicResult<SimultaneityVerdict> {
  if (typeof b !== "number") {
    const deltaT = a;
    const tol = b?.absolute ?? 0;
    if (tol > 0 && Math.abs(deltaT) <= tol && deltaT !== 0) {
      return "indeterminate";
    }
    if (deltaT === 0) return "simultaneous";
    return deltaT > 0 ? "ordered-positive" : "ordered-negative";
  }
  const timeA = a;
  const timeB = b;
  const toleranceAbsoluteS = c ?? 0;
  if (!finite(timeA, timeB)) {
    return outsideDomain("nonfinite-input", "Both times must be finite.");
  }
  if (!Number.isFinite(toleranceAbsoluteS) || toleranceAbsoluteS < 0) {
    return outsideDomain(
      "invalid-tolerance",
      "The tolerance must be a finite, nonnegative number.",
    );
  }
  const diff = timeA - timeB;
  const verdict: SimultaneityVerdict =
    toleranceAbsoluteS > 0 && Math.abs(diff) <= toleranceAbsoluteS && diff !== 0
      ? "indeterminate"
      : diff === 0
        ? "simultaneous"
        : diff > 0
          ? "after"
          : "before";
  return ok(verdict);
}

// ---------------------------------------------------------------------------
// desynchronizationObserved
// ---------------------------------------------------------------------------

export interface DesynchronizationInput {
  readonly properSeparationLs: number;
  readonly beta: number;
}

export type DesynchronizationVerdict =
  | "they-agree"
  | "leading-clock-ahead"
  | "trailing-clock-ahead";

export interface DesynchronizationResult {
  readonly desyncMagnitudeS: number;
  readonly verdict: DesynchronizationVerdict;
}

export function desynchronizationObserved(
  input: DesynchronizationInput,
): KinematicResult<DesynchronizationResult> {
  const { properSeparationLs, beta } = input;
  const badSeparation = refuseSeparation(properSeparationLs);
  if (badSeparation) return badSeparation;
  const bad = refuseSuperluminal(beta);
  if (bad) return bad;
  const signed = kinematicDesynchronization(properSeparationLs, beta, C);
  if (signed.status !== "value") return signed;
  const verdict: DesynchronizationVerdict =
    beta === 0 ? "they-agree" : beta > 0 ? "trailing-clock-ahead" : "leading-clock-ahead";
  return ok({ desyncMagnitudeS: Math.abs(signed.value), verdict });
}

// ---------------------------------------------------------------------------
// causalOrder
// ---------------------------------------------------------------------------

export type CausalClassification = "spacelike" | "lightlike" | "timelike" | "indeterminate";

export interface CausalOrderResult {
  readonly s2: number;
  readonly classification: CausalClassification;
  readonly description: string;
}

export function causalOrder(e1: Event, e2: Event, c = C): KinematicResult<CausalOrderResult> {
  if (!finite(e1.t, e1.x, e2.t, e2.x) || !Number.isFinite(c) || c <= 0) {
    return outsideDomain("nonfinite-input", "Event coordinates and light speed must be finite.");
  }
  const dt = e2.t - e1.t;
  const dx = e2.x - e1.x;
  const dy = (e2.y ?? 0) - (e1.y ?? 0);
  const dz = (e2.z ?? 0) - (e1.z ?? 0);

  const spatialDist2 = dx * dx + dy * dy + dz * dz;
  const timeDist2 = c * c * dt * dt;
  const s2 = spatialDist2 - timeDist2;

  let classification: CausalClassification;
  let description: string;

  if (Math.abs(s2) <= 1e-12) {
    classification = "lightlike";
    description = "Events can be connected only by a light signal propagating at speed c.";
  } else if (s2 > 0) {
    classification = "spacelike";
    description =
      "No signal travelling at or below the speed of light reaches between these events; their time order can be reversed by choosing an appropriate moving reference frame.";
  } else {
    classification = "timelike";
    description =
      "A signal could travel from the first of these events to the second; their time order is invariant under all subluminal Lorentz boosts.";
  }

  return ok({
    s2,
    classification,
    description,
  });
}

// ---------------------------------------------------------------------------
// selectSimultaneousEndpoints & measureRodLength
// ---------------------------------------------------------------------------

export interface SimultaneousEndpointsResult {
  readonly e1: Event;
  readonly e2: Event;
}

export function selectSimultaneousEndpoints(
  rodRestFrame: "K" | "k",
  measuringFrame: "K" | "k",
  v: number,
  L0: number,
  tMeasuring = 0,
  c = C,
): KinematicResult<SimultaneousEndpointsResult> {
  if (!finite(v, L0, tMeasuring, c) || L0 <= 0 || c <= 0) {
    return outsideDomain("invalid-parameters", "L0 and c must be positive, and parameters finite.");
  }
  const gRes = computeGamma(v);
  if (gRes.status !== "value") return gRes;
  const g = gRes.value;

  const measuredSeparation = rodRestFrame === measuringFrame ? L0 : L0 / g;

  return ok({
    e1: { t: tMeasuring, x: 0, y: 0, z: 0 },
    e2: { t: tMeasuring, x: measuredSeparation, y: 0, z: 0 },
  });
}

export type RodMeasurementResult =
  | {
      readonly status: "value";
      readonly isSimultaneous: true;
      readonly measuredLength: number;
      readonly condition?: undefined;
      readonly reason?: undefined;
      readonly repairSuggestedPair?: undefined;
    }
  | {
      readonly status: "not-applicable";
      readonly isSimultaneous: false;
      readonly condition: "non-simultaneous-endpoints";
      readonly reason: string;
      readonly repairSuggestedPair?:
        | {
            readonly e1: Event;
            readonly e2: Event;
          }
        | undefined;
      readonly measuredLength?: undefined;
    };

export function measureRodLength(
  e1InMeasuringFrame: Event,
  e2InMeasuringFrame: Event,
  measuringFrame: "K" | "k",
  rodRestFrame: "K" | "k",
  v: number,
  L0: number,
  c = C,
): RodMeasurementResult {
  const dt = Math.abs(e2InMeasuringFrame.t - e1InMeasuringFrame.t);
  if (dt > 1e-12) {
    const repair = selectSimultaneousEndpoints(
      rodRestFrame,
      measuringFrame,
      v,
      L0,
      e1InMeasuringFrame.t,
      c,
    );
    return {
      status: "not-applicable",
      isSimultaneous: false,
      condition: "non-simultaneous-endpoints",
      reason: "these endpoint events are not simultaneous in the measuring frame (dt != 0)",
      repairSuggestedPair: repair.status === "value" ? repair.value : undefined,
    };
  }

  const measuredLength = Math.abs(e2InMeasuringFrame.x - e1InMeasuringFrame.x);
  return {
    status: "value",
    isSimultaneous: true,
    measuredLength,
  };
}

// ---------------------------------------------------------------------------
// redescribe
// ---------------------------------------------------------------------------

export function redescribe(ledger: Ledger, boostOrBeta: Boost | number): KinematicResult<Ledger>;
export function redescribe(
  events: readonly LedgerEvent[],
  beta: number,
): KinematicResult<readonly LedgerEvent[]>;
export function redescribe(
  target: Ledger | readonly LedgerEvent[],
  boostOrBeta: Boost | number,
): KinematicResult<Ledger> | KinematicResult<readonly LedgerEvent[]> {
  let boost: Boost;
  if (typeof boostOrBeta === "number") {
    const boostRes = alignedBoost(boostOrBeta, C);
    if (boostRes.status !== "value") return boostRes;
    boost = boostRes.value;
  } else {
    boost = boostOrBeta;
  }

  if (Array.isArray(target)) {
    const redescribed: LedgerEvent[] = [];
    for (const event of target) {
      const transformed = transformEvent(event.coordinates, boost);
      if (transformed.status !== "value") return transformed;
      redescribed.push(
        Object.freeze({
          id: event.id,
          kind: event.kind,
          clockId: event.clockId,
          ownClockReading: event.ownClockReading,
          coordinates: transformed.value,
        }),
      );
    }
    return ok(Object.freeze(redescribed));
  }

  const ledger = target as Ledger;
  const newEvents: LedgerEventItem[] = [];
  for (const event of ledger.events) {
    const transformed = transformEvent({ t: event.t, x: event.x, y: event.y, z: event.z }, boost);
    if (transformed.status !== "value") return transformed;
    const item: LedgerEventItem = {
      id: event.id,
      frame: ledger.frame === "K" ? "k" : "K",
      t: transformed.value.t,
      x: transformed.value.x,
      y: transformed.value.y,
      z: transformed.value.z,
      ...(event.label !== undefined ? { label: event.label } : {}),
    };
    newEvents.push(Object.freeze(item));
  }

  return ok(
    Object.freeze({
      runId: ledger.runId,
      frame: ledger.frame === "K" ? "k" : "K",
      events: Object.freeze(newEvents),
    }),
  );
}
