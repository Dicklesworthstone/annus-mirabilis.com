/**
 * Event-ledger and simultaneity reference physics owner for SR-01 (am-sr-01-clock-sync-jbfn)
 * and SR-03 (am-sr-03-rod-simultaneity-0l5i).
 *
 * Natural units throughout: distance in light-seconds, time in seconds, c = 1.0 ls/s.
 */

import {
  type Boost,
  type Event,
  type KinematicResult,
  ok,
  outsideDomain,
} from "./kinematics/types.ts";
import {
  alignedBoost,
  composeCollinear,
  gamma as computeGamma,
  dilationLossPerSecond,
  desynchronization as kinematicDesynchronization,
  transformEvent,
} from "./kinematics.ts";

/** c = 1 light-second per second by construction of this module's natural unit system. */
const C = 1.0;

export type ClockId = string;
export type EventKind = "emission" | "reflection" | "reception" | "marker";

export type Reception = Readonly<{
  sourceEventId: string;
  observerClockId: ClockId;
  receptionTimeS: number;
  receptionCoordinates: Event;
}>;

export type InertialSegment = Readonly<{
  t0: number;
  t1: number;
  x0?: number;
  y0?: number;
  z0?: number;
  vx: number;
  vy?: number;
  vz?: number;
}>;

export type PiecewiseInertialWorldline = Readonly<{
  kind: "piecewise-inertial";
  segments: readonly InertialSegment[];
}>;

export type PrescribedSmoothWorldline = Readonly<{
  kind: "prescribed-smooth";
  velocity: (t: number) => { vx: number; vy?: number; vz?: number };
  position?: (t: number) => { x: number; y: number; z: number };
  declaredError?: number;
}>;

export type ConstantSpeedCircleWorldline = Readonly<{
  kind: "constant-speed-circle";
  radiusLs: number;
  speedBeta: number;
  center?: { x: number; y: number };
}>;

export type Worldline =
  | PiecewiseInertialWorldline
  | PrescribedSmoothWorldline
  | ConstantSpeedCircleWorldline;

export type Clock = Readonly<{
  id: ClockId;
  worldline: Worldline;
}>;

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
      reason:
        "these endpoint events are not simultaneous in the measuring frame, so their separation is not a length measurement (dt != 0)",
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

// ---------------------------------------------------------------------------
// Worldlines and Proper Time (paper 3 §4; SR-05)
// ---------------------------------------------------------------------------

export interface ProperTimeResult {
  readonly properTimeS: number;
  readonly coordinateTimeS: number;
  readonly timeLossS: number;
  readonly ratio: number;
  readonly method: "piecewise-exact" | "numerical-quadrature" | "analytic-closed-form";
  readonly estimatedError?: number;
}

export function properTime(
  worldline: Worldline,
  t0: number,
  t1: number,
  c = C,
): KinematicResult<ProperTimeResult> {
  if (!finite(t0, t1, c) || c <= 0) {
    return outsideDomain(
      "nonfinite-input",
      "Time bounds and light speed must be finite numbers with c > 0.",
    );
  }
  if (t1 < t0) {
    return outsideDomain("invalid-time-interval", "t1 must be greater than or equal to t0.");
  }
  const dtTotal = t1 - t0;
  if (dtTotal === 0) {
    return ok({
      properTimeS: 0,
      coordinateTimeS: 0,
      timeLossS: 0,
      ratio: 1,
      method: "piecewise-exact",
    });
  }

  if (worldline.kind === "constant-speed-circle") {
    const beta = Math.abs(worldline.speedBeta);
    if (!Number.isFinite(beta) || beta >= 1) {
      return outsideDomain("superluminal-speed", "Speed must be strictly subluminal (|beta| < 1).");
    }
    const lossCalc = dilationLossPerSecond(beta);
    if (lossCalc.status !== "value") return lossCalc;
    const lossRate = lossCalc.value.exact;
    const timeLossS = dtTotal * lossRate;
    const properTimeS = dtTotal * Math.sqrt(1 - beta * beta);
    return ok({
      properTimeS,
      coordinateTimeS: dtTotal,
      timeLossS,
      ratio: properTimeS / dtTotal,
      method: "analytic-closed-form",
    });
  }

  if (worldline.kind === "piecewise-inertial") {
    let accumulatedProperTime = 0;
    let accumulatedTimeLoss = 0;

    for (const segment of worldline.segments) {
      const segT0 = Math.max(t0, segment.t0);
      const segT1 = Math.min(t1, segment.t1);
      if (segT1 > segT0) {
        const segDt = segT1 - segT0;
        const vx = segment.vx;
        const vy = segment.vy ?? 0;
        const vz = segment.vz ?? 0;
        if (!finite(vx, vy, vz)) {
          return outsideDomain("nonfinite-velocity", "Segment velocities must be finite numbers.");
        }
        const speed2 = (vx * vx + vy * vy + vz * vz) / (c * c);
        if (speed2 >= 1) {
          return outsideDomain(
            "superluminal-segment",
            "Worldline contains a superluminal segment.",
          );
        }
        const beta = Math.sqrt(speed2);
        const lossCalc = dilationLossPerSecond(beta);
        if (lossCalc.status !== "value") return lossCalc;
        const lossRate = lossCalc.value.exact;
        const segLoss = segDt * lossRate;
        const segProper = segDt * Math.sqrt(1 - speed2);
        accumulatedTimeLoss += segLoss;
        accumulatedProperTime += segProper;
      }
    }

    return ok({
      properTimeS: accumulatedProperTime,
      coordinateTimeS: dtTotal,
      timeLossS: accumulatedTimeLoss,
      ratio: accumulatedProperTime / dtTotal,
      method: "piecewise-exact",
    });
  }

  if (worldline.kind === "prescribed-smooth") {
    // Composite Simpson's rule with Richardson error estimation
    const integrate = (steps: number) => {
      const h = dtTotal / steps;
      let sum = 0;
      let sumLoss = 0;
      for (let i = 0; i <= steps; i++) {
        const t = t0 + i * h;
        const vel = worldline.velocity(t);
        const vx = vel.vx;
        const vy = vel.vy ?? 0;
        const vz = vel.vz ?? 0;
        if (!finite(vx, vy, vz)) {
          throw new Error("nonfinite-velocity");
        }
        const speed2 = (vx * vx + vy * vy + vz * vz) / (c * c);
        if (speed2 >= 1) {
          throw new Error("superluminal-segment");
        }
        const beta = Math.sqrt(speed2);
        const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
        const factor = Math.sqrt(1 - speed2);
        const lossFactor = (beta * beta) / (1 + factor);
        sum += weight * factor;
        sumLoss += weight * lossFactor;
      }
      return {
        tau: (h / 3) * sum,
        loss: (h / 3) * sumLoss,
      };
    };

    try {
      const coarse = integrate(100);
      const fine = integrate(200);
      const estimatedError = Math.abs(fine.tau - coarse.tau) / 15;
      if (worldline.declaredError !== undefined && estimatedError > worldline.declaredError) {
        return outsideDomain(
          "declared-error-exceeded",
          `Numerical quadrature error (${estimatedError}) exceeds declared error (${worldline.declaredError}).`,
        );
      }
      return ok({
        properTimeS: fine.tau,
        coordinateTimeS: dtTotal,
        timeLossS: fine.loss,
        ratio: fine.tau / dtTotal,
        method: "numerical-quadrature",
        estimatedError,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "superluminal-segment") {
        return outsideDomain("superluminal-segment", "Worldline contains a superluminal segment.");
      }
      return outsideDomain("nonfinite-velocity", "Velocities along smooth path must be finite.");
    }
  }

  return outsideDomain("invalid-worldline", "Unknown worldline kind.");
}

// ---------------------------------------------------------------------------
// reunionComparison & reciprocalRates
// ---------------------------------------------------------------------------

export interface ReunionComparisonResult {
  readonly status: "value";
  readonly clock1ProperTimeS: number;
  readonly clock2ProperTimeS: number;
  readonly properTimeDifferenceS: number;
  readonly laggingClock: "clock1" | "clock2" | "neither";
  readonly isFrameIndependent: true;
  readonly explanation: string;
}

export function reunionComparison(
  w1: Worldline,
  w2: Worldline,
  t0: number,
  t1: number,
  c = C,
): KinematicResult<ReunionComparisonResult> {
  const r1 = properTime(w1, t0, t1, c);
  if (r1.status !== "value") return r1;
  const r2 = properTime(w2, t0, t1, c);
  if (r2.status !== "value") return r2;

  const tau1 = r1.value.properTimeS;
  const tau2 = r2.value.properTimeS;
  const diff = Math.abs(tau1 - tau2);
  const laggingClock: "clock1" | "clock2" | "neither" =
    Math.abs(tau1 - tau2) <= 1e-12 ? "neither" : tau1 < tau2 ? "clock1" : "clock2";

  return ok({
    status: "value",
    clock1ProperTimeS: tau1,
    clock2ProperTimeS: tau2,
    properTimeDifferenceS: diff,
    laggingClock,
    isFrameIndependent: true,
    explanation:
      "The reunion comparison is frame-independent because proper time tau = integral sqrt(1 - v(t)^2/c^2) dt is the invariant spacetime interval along each worldline between the invariant intersection events. The clock that changed inertial frames travelled a shorter spacetime path, recording less proper time. The difference is entirely determined by the invariant path integral along each worldline, not by an ad-hoc penalty at turnaround.",
  });
}

export interface ReciprocalRatesResult {
  readonly clock1SpeedInFrame: number;
  readonly clock2SpeedInFrame: number;
  readonly relativeSpeedBeta: number;
  readonly clock1RateInFrame: number;
  readonly clock2RateInFrame: number;
  readonly clock2RateAccordingToClock1: number;
  readonly clock1RateAccordingToClock2: number;
  readonly explanation: string;
}

export function reciprocalRates(
  v1: number,
  v2: number,
  c = C,
): KinematicResult<ReciprocalRatesResult> {
  if (!finite(v1, v2, c) || c <= 0) {
    return outsideDomain(
      "nonfinite-input",
      "Speeds and light speed must be finite numbers with c > 0.",
    );
  }
  const beta1 = v1 / c;
  const beta2 = v2 / c;
  if (Math.abs(beta1) >= 1 || Math.abs(beta2) >= 1) {
    return outsideDomain("superluminal-speed", "Clocks must have strictly subluminal speeds.");
  }

  // Einstein velocity composition for relative velocity
  const vRelRes = composeCollinear(beta2, -beta1);
  if (vRelRes.status !== "value") return vRelRes;
  const betaMagnitude = Math.abs(vRelRes.value);

  const rate1InFrame = Math.sqrt(1 - beta1 * beta1);
  const rate2InFrame = Math.sqrt(1 - beta2 * beta2);
  const mutualRelativeRate = Math.sqrt(1 - betaMagnitude * betaMagnitude);

  return ok({
    clock1SpeedInFrame: Math.abs(v1),
    clock2SpeedInFrame: Math.abs(v2),
    relativeSpeedBeta: betaMagnitude,
    clock1RateInFrame: rate1InFrame,
    clock2RateInFrame: rate2InFrame,
    clock2RateAccordingToClock1: mutualRelativeRate,
    clock1RateAccordingToClock2: mutualRelativeRate,
    explanation:
      "In each inertial clock's own rest frame, the other clock is judged to run slower by the factor sqrt(1 - v_rel^2/c^2). This reciprocal time dilation is completely symmetric between inertial frames and describes coordinate-time slicing. It does not conflict with reunion comparisons, which compare total proper time along complete worldlines between common spacetime events.",
  });
}

// ---------------------------------------------------------------------------
// lightClock & equatorPoleComparison
// ---------------------------------------------------------------------------

export interface LightClockResult {
  readonly L0: number;
  readonly beta: number;
  readonly properTickPeriodS: number;
  readonly coordinateTickPeriodS: number;
  readonly roundTripPathLengthLs: number;
  readonly transverseLegLs: number;
  readonly longitudinalDistanceMovedLs: number;
  readonly oneWayLightPathLs: number;
  readonly gamma: number;
  readonly pedagogicalRole: "later pedagogical construction; not a 1905 paper 3 derivation";
}

export function lightClock(L0: number, beta: number, c = C): KinematicResult<LightClockResult> {
  if (!finite(L0, beta, c) || L0 <= 0 || c <= 0) {
    return outsideDomain("invalid-parameters", "L0 and c must be positive, and parameters finite.");
  }
  const absBeta = Math.abs(beta);
  if (absBeta >= 1) {
    return outsideDomain(
      "superluminal-speed",
      "Light clock speed must be strictly subluminal (|beta| < 1).",
    );
  }

  const gRes = computeGamma(absBeta);
  if (gRes.status !== "value") return gRes;
  const gamma = gRes.value;

  const properTickPeriodS = (2 * L0) / c;
  const coordinateTickPeriodS = gamma * properTickPeriodS;
  const roundTripPathLengthLs = c * coordinateTickPeriodS;
  const longitudinalDistanceMovedLs = absBeta * c * coordinateTickPeriodS;
  const oneWayLightPathLs = roundTripPathLengthLs / 2;

  return ok({
    L0,
    beta,
    properTickPeriodS,
    coordinateTickPeriodS,
    roundTripPathLengthLs,
    transverseLegLs: L0,
    longitudinalDistanceMovedLs,
    oneWayLightPathLs,
    gamma,
    pedagogicalRole: "later pedagogical construction; not a 1905 paper 3 derivation",
  });
}

export function equatorPoleComparison(): KinematicResult<never> {
  return outsideDomain(
    "outside-domain",
    "Real terrestrial clock comparisons require general relativity: kinematic dilation at the equator is cancelled by gravitational redshift on the Earth's geoid. Special relativity alone is outside domain.",
  );
}
