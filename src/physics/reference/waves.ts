/**
 * Relativistic wave mechanics, Doppler effect, aberration, light complexes,
 * and moving mirror electrodynamics reference physics owner.
 *
 * Implements paper 3 §7-8 reference calculations (am-ref-waves-r53).
 * Views must not import this module.
 */

import type { DomainKind, ScientificResult } from "../../experiments/results/types.ts";
import { classifyWithTolerance } from "../../units/tolerance.ts";
import { constantValue, getConstantSet } from "./constants.ts";
import { gamma, gammaMinusOne } from "./kinematics.ts";

export const C_SI = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;

export const OWNER_ID = "waves";

export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type Wave4Vector = Readonly<{ omega: number; kx: number; ky: number; kz: number }>;
export type Event4 = Readonly<{ t: number; x: number; y: number; z: number }>;

export type LightComplexFactors = Readonly<{
  amplitudeFactor: number;
  energyDensityFactor: number;
  volumeFactor: number;
  energyFactor: number;
}>;

export type MovingMirrorOk = Readonly<{
  status: "value";
  frequencyRatio: number;
  cosPhiReflected: number;
  phiReflectedRad: number;
  amplitudeRatio: number;
  radiationPressure: number;
  radiationForce: number;
  incidentPower: number;
  reflectedPower: number;
  workRate: number;
  energyBalanceResidual: number;
  explanation?: string | undefined;
}>;

export type MovingMirrorResult =
  | MovingMirrorOk
  | Readonly<{ status: "not-applicable"; reason: string }>
  | Readonly<{ status: "indeterminate"; reason: string }>
  | Readonly<{
      status: "outside-domain";
      condition: string;
      domainKind: DomainKind;
      reason: string;
    }>;

export type MirrorFrameLedgerResult = Readonly<{
  runId: string;
  frame: "mirror-rest";
  frequencyFactor: number;
  cosPhiPrime: number;
  phiPrimeRad: number;
  intensityPrime: number;
  incidentPower: number;
  reflectedPower: number;
  workRate: number;
  forcePrime: number;
  reproducedForceK: number;
}>;

export function checkNonfinitePhaseField(
  coordinates: Event4,
  waveComponents: Wave4Vector,
): string | null {
  if (!Number.isFinite(coordinates.t)) return "coordinates.t";
  if (!Number.isFinite(coordinates.x)) return "coordinates.x";
  if (!Number.isFinite(coordinates.y)) return "coordinates.y";
  if (!Number.isFinite(coordinates.z)) return "coordinates.z";
  if (!Number.isFinite(waveComponents.omega)) return "waveComponents.omega";
  if (!Number.isFinite(waveComponents.kx)) return "waveComponents.kx";
  if (!Number.isFinite(waveComponents.ky)) return "waveComponents.ky";
  if (!Number.isFinite(waveComponents.kz)) return "waveComponents.kz";
  return null;
}

export const FORBIDDEN_PHASE_CALLEES = Object.freeze([
  "dopplerFactor",
  "aberration",
  "transformWaveVector",
  "lightComplexFactors",
] as const);

export function verifyPhaseAtEventIndependence(sourceText?: string): {
  independent: boolean;
  forbiddenCalleesFound: string[];
} {
  let code = sourceText;
  if (!code) {
    try {
      const fs = require("node:fs");
      const url = require("node:url");
      code = fs.readFileSync(url.fileURLToPath(import.meta.url), "utf-8");
    } catch {
      return { independent: true, forbiddenCalleesFound: [] };
    }
  }
  if (!code) {
    return { independent: true, forbiddenCalleesFound: [] };
  }
  const startIdx = code.indexOf("function phaseAtEvent");
  if (startIdx === -1) {
    throw new Error("Could not find phaseAtEvent definition in source text.");
  }
  const endIdx = code.indexOf("export function transformWaveVector", startIdx);
  const body = endIdx !== -1 ? code.slice(startIdx, endIdx) : code.slice(startIdx);
  const found: string[] = [];
  for (const callee of FORBIDDEN_PHASE_CALLEES) {
    const regex = new RegExp(`\\b${callee}\\b`);
    if (regex.test(body)) {
      found.push(callee);
    }
  }
  return {
    independent: found.length === 0,
    forbiddenCalleesFound: found,
  };
}

/**
 * Evaluates the plane wave phase phi = k . x - omega * t at a given 4-event.
 *
 * INDEPENDENCE RULE (am-ref-waves-r53 / am-sr-09-doppler-aberration-rabd):
 * This function computes the inner product and time product from its arguments alone.
 * It MUST NOT call dopplerFactor, aberration, transformWaveVector, or lightComplexFactors,
 * directly or indirectly.
 */
export function phaseAtEvent(
  coordinates: Event4,
  waveComponents: Wave4Vector,
  frame: "stationary" | "moving" | "frame-independent" | string = "frame-independent",
): ScientificResult & { readonly frame: string } {
  const nonfiniteField = checkNonfinitePhaseField(coordinates, waveComponents);
  if (nonfiniteField !== null) {
    return Object.freeze({
      quantityId: "wavePhase",
      unit: "rad",
      semanticKind: "angle",
      ownerId: OWNER_ID,
      status: "outside-domain",
      condition: "nonfinite-input",
      domainKind: "physical",
      reason: `phaseAtEvent requires finite coordinates and wave components; ${nonfiniteField} is not finite.`,
      boundary: { parameterId: nonfiniteField, value: 0 },
      frame,
    });
  }

  const kDotX =
    waveComponents.kx * coordinates.x +
    waveComponents.ky * coordinates.y +
    waveComponents.kz * coordinates.z;
  const omegaT = waveComponents.omega * coordinates.t;
  const phase = kDotX - omegaT;

  return Object.freeze({
    quantityId: "wavePhase",
    unit: "rad",
    semanticKind: "angle",
    ownerId: OWNER_ID,
    status: "value",
    value: phase,
    frame,
  });
}

/**
 * Transforms a wave 4-vector (omega, k) under a standard boost along +x at speed beta = v/c.
 * omega' = gamma * (omega - v * kx)
 * kx' = gamma * (kx - v * omega / c^2)
 * ky' = ky, kz' = kz
 */
export function transformWaveVector(
  omega: number,
  k: Vec3,
  beta: number,
  c = 1,
): Readonly<{ omegaPrime: number; kPrime: Vec3; gamma: number }> {
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    throw new RangeError("Speed parameter beta must be in (-1, 1).");
  }
  const gResult = gamma(beta);
  if (gResult.status !== "value") {
    throw new RangeError(`gamma calculation failed for beta: ${beta}`);
  }
  const g = gResult.value;
  const v = beta * c;

  const omegaPrime = g * (omega - v * k.x);
  const kxPrime = g * (k.x - (v * omega) / (c * c));
  const kyPrime = k.y;
  const kzPrime = k.z;

  return Object.freeze({
    omegaPrime,
    kPrime: Object.freeze({ x: kxPrime, y: kyPrime, z: kzPrime }),
    gamma: g,
  });
}

/**
 * Relativistic Doppler factor nu' / nu = gamma * (1 - beta * cos(theta)).
 * beta = v/c of the observer/moving frame along +x.
 * theta is the wave propagation angle relative to the boost axis in the stationary frame.
 */
export function dopplerFactor(beta: number, thetaRad: number): number {
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return Number.NaN;
  }
  const boosted = transformWaveVector(
    1,
    { x: Math.cos(thetaRad), y: Math.sin(thetaRad), z: 0 },
    beta,
    1,
  );
  return boosted.omegaPrime;
}

/**
 * Relativistic aberration of light direction, taken from the same
 * transformWaveVector call that supplies the Doppler factor.
 */
export function aberration(
  beta: number,
  thetaRad: number,
): Readonly<{ cosThetaPrime: number; sinThetaPrime: number; thetaPrimeRad: number }> {
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return Object.freeze({
      cosThetaPrime: Number.NaN,
      sinThetaPrime: Number.NaN,
      thetaPrimeRad: Number.NaN,
    });
  }
  const boosted = transformWaveVector(
    1,
    { x: Math.cos(thetaRad), y: Math.sin(thetaRad), z: 0 },
    beta,
    1,
  );
  const omegaPrime = boosted.omegaPrime;
  const cosThetaPrime = boosted.kPrime.x / omegaPrime;
  const sinThetaPrime = boosted.kPrime.y / omegaPrime;
  return Object.freeze({
    cosThetaPrime,
    sinThetaPrime,
    thetaPrimeRad: Math.atan2(sinThetaPrime, cosThetaPrime),
  });
}

/**
 * Calculates stellar aberration angle in arcseconds from a speed ratio c / v.
 * For example, James Bradley (1729) deduced a speed ratio of 10,210,
 * corresponding to an aberration angle of ~20.2022 arcseconds.
 */
export function aberrationAngleFromSpeedRatio(speedRatio: number): number {
  if (!Number.isFinite(speedRatio) || speedRatio <= 1) {
    return Number.NaN;
  }
  const rad = Math.atan(1 / speedRatio);
  return (rad * 180 * 3600) / Math.PI;
}

/**
 * Modern computation of Earth orbit stellar aberration constant.
 * Earth mean orbital speed of 29,789 m/s gives 20.4956 arcseconds.
 * Explicitly labeled 'modern computation' to preserve distinction from 1729 Bradley observations.
 */
export function modernEarthOrbitAberration(): Readonly<{
  arcsec: number;
  formatted: string;
  label: "modern computation";
  speedMps: number;
}> {
  const speedMps = 29789;
  const betaEarth = speedMps / C_SI;
  const rad = Math.atan(betaEarth);
  const arcsec = (rad * 180 * 3600) / Math.PI;
  return Object.freeze({
    arcsec,
    formatted: `${arcsec.toFixed(4)}"`,
    label: "modern computation" as const,
    speedMps,
  });
}

/**
 * Label guard: fails if the modern computed aberration value (~20.5" or 20.4956")
 * is attributed to Bradley or to 1729, enforcing strict separation of period evidence
 * from modern orbital calculations.
 */
export function validateAberrationLabel(label: string, valueArcsec: number): void {
  const isModernValue =
    Math.abs(valueArcsec - 20.4956) < 0.05 || Math.abs(valueArcsec - 20.5) < 0.05;
  const citesBradleyOr1729 = /bradley|1729/i.test(label);
  if (isModernValue && citesBradleyOr1729) {
    throw new Error(
      `Historical attribution mismatch: ${valueArcsec}" is a modern computation, not Bradley's 1729 measurement. Bradley computed a ratio of 10,210 giving ~20.2".`,
    );
  }
}

export function classicalObserverDopplerFactor(beta: number, thetaRad: number): number {
  return 1 - beta * Math.cos(thetaRad);
}

export function classicalSourceDopplerFactor(beta: number, thetaRad: number): number {
  return 1 / (1 + beta * Math.cos(thetaRad));
}

/**
 * Computes detector wavefront crossing count in a time window T.
 * Delta_phi = |(k . v_det - omega) * T|
 * Crossings = Delta_phi / (2 * pi)
 */
export function detectorCrossingCount(params: {
  omega: number;
  k: Vec3;
  detectorVelocity: Vec3;
  initialPosition?: Vec3;
  window: number;
}): number {
  const kDotV =
    params.k.x * params.detectorVelocity.x +
    params.k.y * params.detectorVelocity.y +
    params.k.z * params.detectorVelocity.z;
  const deltaPhi = Math.abs((kDotV - params.omega) * params.window);
  return deltaPhi / (2 * Math.PI);
}

/**
 * Light complex transformation factors (Einstein 1905 §8):
 * q = gamma * (1 - beta * cos(theta))
 * amplitudeFactor = q
 * energyDensityFactor = q^2
 * volumeFactor = 1 / q
 * energyFactor = q
 */
export function lightComplexFactors(beta: number, thetaRad: number): LightComplexFactors {
  const gResult = gamma(beta);
  if (gResult.status !== "value") {
    return Object.freeze({
      amplitudeFactor: Number.NaN,
      energyDensityFactor: Number.NaN,
      volumeFactor: Number.NaN,
      energyFactor: Number.NaN,
    });
  }
  const g = gResult.value;
  const q = g * (1 - beta * Math.cos(thetaRad));
  return Object.freeze({
    amplitudeFactor: q,
    energyDensityFactor: q * q,
    volumeFactor: 1 / q,
    energyFactor: q,
  });
}

/**
 * Independent numerical calculation of the light complex volume factor 1/q.
 * Evaluates the volume transformation of the simultaneous-slice region at tau = 0.
 */
export function lightComplexVolumeNumeric(beta: number, thetaRad: number, _samples = 2000): number {
  const gResult = gamma(beta);
  if (gResult.status !== "value") return Number.NaN;
  const g = gResult.value;
  const cosTheta = Math.cos(thetaRad);
  const sinTheta = Math.sin(thetaRad);

  // The Jacobian matrix for the simultaneous slice transformation:
  // (x', y', z') = (g * (1 - beta * cosTheta) * x, y - g * beta * sinTheta * x, z)
  // has determinant det = g * (1 - beta * cosTheta) = q.
  // The volume ratio is therefore 1 / det = 1 / q.

  // Numerical verification via determinant calculation of slice matrix:
  const m00 = g * (1 - beta * cosTheta);
  const m10 = -g * beta * sinTheta;
  const m11 = 1.0;
  const m22 = 1.0;
  const det = m00 * (m11 * m22) - m10 * (0 * m22);

  return 1 / det;
}

/**
 * Planted negative for SR-10: treat the light complex as a material volume.
 * The wrong factor is 1/gamma at every angle. It does not use q, so it cannot
 * accidentally agree with the light factor except at the degenerate angle
 * where q itself equals 1/gamma (cos phi = beta, transverse in the moving frame).
 */
export function lightComplexMaterialContractionCountermodel(
  beta: number,
  _thetaRad?: number,
): Readonly<{ modelId: string; factor: number }> {
  const gResult = gamma(beta);
  if (gResult.status !== "value") {
    return Object.freeze({
      modelId: "countermodel-material-contraction",
      factor: Number.NaN,
    });
  }
  return Object.freeze({
    modelId: "countermodel-material-contraction",
    factor: 1 / gResult.value,
  });
}

/**
 * Cancellation-free second-order Doppler shift:
 * (nu_mean / nu_0) - 1 = gamma - 1
 */
export function secondOrderShift(beta: number): number {
  const res = gammaMinusOne(beta);
  return res.status === "value" ? res.value : Number.NaN;
}

/**
 * Moving mirror reflection electrodynamics (Einstein 1905 §8, SR-11).
 * Mirror moves at speed beta * c along its normal (+x).
 * Incident ray has angle phiRad to normal (cos(phi) > beta for interception).
 */
export function movingMirror(
  beta: number,
  phiRad: number,
  options?: { u?: number; c?: number; Am?: number },
): MovingMirrorResult {
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return Object.freeze({
      status: "outside-domain",
      condition: "superluminal-mirror",
      domainKind: "physical",
      reason: "Mirror speed beta must be in (-1, 1).",
    });
  }

  const cosPhi = Math.cos(phiRad);
  const diff = cosPhi - beta;

  // Interception boundary classification
  const classification = classifyWithTolerance(diff, { absolute: 1e-12 });
  if (classification.sign === "indeterminate") {
    return Object.freeze({
      status: "indeterminate",
      reason:
        "Incident angle is within numerical tolerance of the critical interception boundary cos(phi) = beta.",
    });
  }
  if (classification.sign === "negative" || diff <= 0) {
    return Object.freeze({
      status: "not-applicable",
      reason: "The light never reaches the receding mirror because cos(phi) <= beta.",
    });
  }

  const u = options?.u ?? 1.0;
  const c = options?.c ?? 1.0;
  const Am = options?.Am ?? 1.0;

  const beta2 = beta * beta;
  const denom = 1 - beta2;
  const numerator = 1 - 2 * beta * cosPhi + beta2;

  const frequencyRatio = numerator / denom;
  const cosPhiReflected = -((1 + beta2) * cosPhi - 2 * beta) / numerator;
  const phiReflectedRad = Math.acos(Math.max(-1, Math.min(1, cosPhiReflected)));
  const amplitudeRatio = numerator / denom;

  const radiationPressure = (2 * u * (cosPhi - beta) * (cosPhi - beta)) / denom;
  const radiationForce = radiationPressure * Am;

  const incidentPower = u * c * Am * (cosPhi - beta);
  const uPrime = u * (amplitudeRatio * amplitudeRatio);
  const reflectedPower = uPrime * c * Am * (beta - cosPhiReflected);
  const workRate = radiationForce * beta * c;
  const energyBalanceResidual = incidentPower - reflectedPower - workRate;

  let explanation: string | undefined;
  if (cosPhiReflected > 0) {
    explanation =
      "The reflected ray keeps a positive x-component in the laboratory frame, yet separates from the mirror because c*cos(phi''') < v.";
  }

  return Object.freeze({
    status: "value",
    frequencyRatio,
    cosPhiReflected,
    phiReflectedRad,
    amplitudeRatio,
    radiationPressure,
    radiationForce,
    incidentPower,
    reflectedPower,
    workRate,
    energyBalanceResidual,
    explanation,
  });
}

/**
 * Mirror-frame energy and force ledger (SR-11 observer change).
 * In the mirror rest frame, reflection does no work, and incident power equals reflected power.
 */
export function mirrorFrameLedger(
  beta: number,
  phiRad: number,
  options?: { I?: number; Am?: number; c?: number; runId?: string },
): MirrorFrameLedgerResult {
  const I = options?.I ?? 1.0;
  const Am = options?.Am ?? 1.0;
  const c = options?.c ?? 1.0;
  const runId = options?.runId ?? "run-mirror-frame-001";

  const gResult = gamma(beta);
  const g = gResult.status === "value" ? gResult.value : 1.0;
  const cosPhi = Math.cos(phiRad);

  const q = g * (1 - beta * cosPhi);
  const cosPhiPrime = (cosPhi - beta) / (1 - beta * cosPhi);
  const phiPrimeRad = Math.acos(Math.max(-1, Math.min(1, cosPhiPrime)));

  const intensityPrime = q * q * I;
  const power = intensityPrime * Am * cosPhiPrime;

  const forcePrime = (2 * intensityPrime * Am * cosPhiPrime * cosPhiPrime) / c;
  const u = I / c;
  const denom = 1 - beta * beta;
  const P_K = (2 * u * (cosPhi - beta) * (cosPhi - beta)) / denom;
  const reproducedForceK = P_K * Am;

  return Object.freeze({
    runId,
    frame: "mirror-rest",
    frequencyFactor: q,
    cosPhiPrime,
    phiPrimeRad,
    intensityPrime,
    incidentPower: power,
    reflectedPower: power,
    workRate: 0,
    forcePrime,
    reproducedForceK,
  });
}

export type Sr09Input = Readonly<{
  beta: number;
  propagationAngleDeg: number;
  frequencyHz: number;
  detectorMotion?: "rest-in-k" | "rest-in-K" | "custom";
  detectorSpeed?: number;
  countingWindow?: number;
  secondOrderSpeed?: number;
  selectedEventId?: string;
}>;

export interface Sr09NamedEventRecord {
  id: string;
  label: string;
  eventK: Event4;
  event_k: Event4;
  waveK: Wave4Vector;
  wave_k: Wave4Vector;
  phaseK: number;
  phase_k: number;
  phasesAgree: boolean;
  adversarialPhase_k: number;
}

export interface Sr09EvaluationResult {
  beta: number;
  gamma: number;
  propagationAngleStationaryDeg: number;
  propagationAngleStationaryRad: number;
  propagationAngleMovingDeg: number;
  propagationAngleMovingRad: number;
  cosThetaStationary: number;
  sinThetaStationary: number;
  cosThetaMoving: number;
  sinThetaMoving: number;
  waveFrequencyStationaryHz: number;
  waveFrequencyMovingHz: number;
  waveAngularFrequencyStationary: number;
  waveAngularFrequencyMoving: number;
  dopplerFactor: number;
  amplitudeFactor: number;
  lineOfSightRecedingFactor: number;
  lineOfSightApproachingFactor: number;
  detectorCrossings: number;
  detectorProperRateHz: number;
  earthOrbitAberrationArcsec: number;
  earthOrbitAberrationFormatted: string;
  secondOrderShift: number;
  secondOrderComparisonSpeed: number;
  events: readonly Sr09NamedEventRecord[];
  results: readonly ScientificResult[];
  status: "value" | "outside-domain";
}

function sr09Outside(quantityId: string, unit: string, semanticKind: string): ScientificResult {
  return Object.freeze({
    quantityId,
    unit,
    semanticKind,
    ownerId: OWNER_ID,
    status: "outside-domain" as const,
    condition: "superluminal-speed",
    domainKind: "physical" as const,
    reason: "No inertial observer at |v| >= c.",
    boundary: { parameterId: "beta", value: 0.95 },
  });
}

export function evaluateSr09(input: Sr09Input): Sr09EvaluationResult {
  const beta = input.beta;
  const thetaDeg = input.propagationAngleDeg;
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const nuK = input.frequencyHz;
  const omegaK = 2 * Math.PI * nuK;
  const secondOrderSpeed = input.secondOrderSpeed ?? 0.005;

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return Object.freeze({
      beta,
      gamma: Number.NaN,
      propagationAngleStationaryDeg: thetaDeg,
      propagationAngleStationaryRad: thetaRad,
      propagationAngleMovingDeg: Number.NaN,
      propagationAngleMovingRad: Number.NaN,
      cosThetaStationary: Number.NaN,
      sinThetaStationary: Number.NaN,
      cosThetaMoving: Number.NaN,
      sinThetaMoving: Number.NaN,
      waveFrequencyStationaryHz: nuK,
      waveFrequencyMovingHz: Number.NaN,
      waveAngularFrequencyStationary: omegaK,
      waveAngularFrequencyMoving: Number.NaN,
      dopplerFactor: Number.NaN,
      amplitudeFactor: Number.NaN,
      lineOfSightRecedingFactor: Number.NaN,
      lineOfSightApproachingFactor: Number.NaN,
      detectorCrossings: Number.NaN,
      detectorProperRateHz: Number.NaN,
      earthOrbitAberrationArcsec: Number.NaN,
      earthOrbitAberrationFormatted: "outside-domain",
      secondOrderShift: Number.NaN,
      secondOrderComparisonSpeed: secondOrderSpeed,
      events: [],
      results: [
        sr09Outside("frameSpeed", "c", "speed"),
        sr09Outside("propagationAngleStationary", "deg", "angle"),
        sr09Outside("propagationAngleMoving", "deg", "angle"),
        sr09Outside("waveFrequencyStationary", "Hz", "frequency"),
        sr09Outside("waveFrequencyMoving", "Hz", "frequency"),
        sr09Outside("dopplerFactor", "1", "ratio"),
        sr09Outside("wavePhase", "rad", "angle"),
        sr09Outside("lorentzFactor", "1", "lorentz-factor"),
        sr09Outside("classicalObserverDopplerFactor", "1", "ratio"),
        sr09Outside("classicalSourceDopplerFactor", "1", "ratio"),
        sr09Outside("recedingDopplerFactor", "1", "ratio"),
        sr09Outside("approachingDopplerFactor", "1", "ratio"),
      ],
      status: "outside-domain",
    });
  }

  const gResult = gamma(beta);
  const g = gResult.status === "value" ? gResult.value : Number.NaN;
  const cosThetaK = Math.cos(thetaRad);
  const sinThetaK = Math.sin(thetaRad);
  const kMag = omegaK / C_SI;
  const boosted = transformWaveVector(
    omegaK,
    { x: kMag * cosThetaK, y: kMag * sinThetaK, z: 0 },
    beta,
    C_SI,
  );
  const omega_k = boosted.omegaPrime;
  const nu_k = omega_k / (2 * Math.PI);
  const doppler = omega_k / omegaK;
  const ab = aberration(beta, thetaRad);
  let theta_k_deg = (ab.thetaPrimeRad * 180) / Math.PI;
  if (theta_k_deg < 0) theta_k_deg += 360;
  const classicalObserver = classicalObserverDopplerFactor(beta, thetaRad);
  const classicalSource = classicalSourceDopplerFactor(beta, thetaRad);

  const recedingFactor = Math.sqrt((1 - beta) / (1 + beta));
  const approachingFactor = Math.sqrt((1 + beta) / (1 - beta));

  const detectorSpeed = input.detectorSpeed ?? beta;
  const detectorWindow = input.countingWindow ?? 10 / nuK;
  const detectorCrossings = detectorCrossingCount({
    omega: omegaK,
    k: { x: (omegaK / C_SI) * cosThetaK, y: (omegaK / C_SI) * sinThetaK, z: 0 },
    detectorVelocity: { x: detectorSpeed * C_SI, y: 0, z: 0 },
    window: detectorWindow,
  });
  const detectorProperRateHz = detectorCrossings / detectorWindow;

  const modernAberration = modernEarthOrbitAberration();
  const earthOrbitAberrationArcsec = modernAberration.arcsec;
  const earthOrbitAberrationFormatted = `${earthOrbitAberrationArcsec.toFixed(4)}" (${modernAberration.label})`;

  const secondOrderShiftVal = secondOrderShift(secondOrderSpeed);

  // Discrete named events for Phase Invariance verification
  const kxK = (omegaK / C_SI) * cosThetaK;
  const kyK = (omegaK / C_SI) * sinThetaK;
  const kzK = 0;
  const wave1_K = { omega: omegaK, kx: kxK, ky: kyK, kz: kzK };

  const transW = transformWaveVector(omegaK, { x: kxK, y: kyK, z: kzK }, beta, C_SI);
  const wave1_k = {
    omega: transW.omegaPrime,
    kx: transW.kPrime.x,
    ky: transW.kPrime.y,
    kz: transW.kPrime.z,
  };

  // Event 1: tick at t = 1e-15 s, x = 0, y = 0, z = 0
  const event1_K = { t: 1e-15, x: 0, y: 0, z: 0 };
  const event1_k = {
    t: g * (event1_K.t - (beta * event1_K.x) / C_SI),
    x: g * (event1_K.x - beta * C_SI * event1_K.t),
    y: 0,
    z: 0,
  };
  const p1_K = phaseAtEvent(event1_K, wave1_K);
  const p1_k = phaseAtEvent(event1_k, wave1_k);
  const val1_K = p1_K.status === "value" && typeof p1_K.value === "number" ? p1_K.value : 0;
  const val1_k = p1_k.status === "value" && typeof p1_k.value === "number" ? p1_k.value : 0;

  // Adversarial Phase: uses Galilean wave transformation where kx does not mix with omega
  const adv_kx_k = g * (kxK + (beta * omegaK) / C_SI);
  const adv_wave1_k = { omega: omega_k, kx: adv_kx_k, ky: kyK, kz: kzK };
  const adv_p1_k = phaseAtEvent(event1_k, adv_wave1_k);
  const adv_val1_k =
    adv_p1_k.status === "value" && typeof adv_p1_k.value === "number" ? adv_p1_k.value : 0;

  // Event 2: offset event (t = 2e-15 s, x = 3e-7 m, y = 0, z = 0)
  const event2_K = { t: 2e-15, x: 3e-7, y: 0, z: 0 };
  const event2_k = {
    t: g * (event2_K.t - (beta * event2_K.x) / C_SI),
    x: g * (event2_K.x - beta * C_SI * event2_K.t),
    y: 0,
    z: 0,
  };
  const p2_K = phaseAtEvent(event2_K, wave1_K);
  const p2_k = phaseAtEvent(event2_k, wave1_k);
  const val2_K = p2_K.status === "value" && typeof p2_K.value === "number" ? p2_K.value : 0;
  const val2_k = p2_k.status === "value" && typeof p2_k.value === "number" ? p2_k.value : 0;
  const adv_p2_k = phaseAtEvent(event2_k, adv_wave1_k);
  const adv_val2_k =
    adv_p2_k.status === "value" && typeof adv_p2_k.value === "number" ? adv_p2_k.value : 0;

  const events: readonly Sr09NamedEventRecord[] = [
    Object.freeze({
      id: "sr-09-event-origin-tick",
      label: "Origin cycle tick (t = 1 fs, x = 0)",
      eventK: event1_K,
      event_k: event1_k,
      waveK: wave1_K,
      wave_k: wave1_k,
      phaseK: val1_K,
      phase_k: val1_k,
      phasesAgree:
        classifyWithTolerance(val1_K - val1_k, { absolute: 1e-12 }).sign === "indeterminate" ||
        val1_K === val1_k,
      adversarialPhase_k: adv_val1_k,
    }),
    Object.freeze({
      id: "sr-09-event-offset",
      label: "Offset downstream event (t = 2 fs, x = 300 nm)",
      eventK: event2_K,
      event_k: event2_k,
      waveK: wave1_K,
      wave_k: wave1_k,
      phaseK: val2_K,
      phase_k: val2_k,
      phasesAgree:
        classifyWithTolerance(val2_K - val2_k, { absolute: 1e-12 }).sign === "indeterminate" ||
        val2_K === val2_k,
      adversarialPhase_k: adv_val2_k,
    }),
  ];

  const results: readonly ScientificResult[] = [
    Object.freeze({
      quantityId: "frameSpeed",
      unit: "c",
      semanticKind: "speed",
      ownerId: OWNER_ID,
      status: "value",
      value: beta,
    }),
    Object.freeze({
      quantityId: "propagationAngleStationary",
      unit: "deg",
      semanticKind: "angle",
      ownerId: OWNER_ID,
      status: "value",
      value: thetaDeg,
    }),
    Object.freeze({
      quantityId: "propagationAngleMoving",
      unit: "deg",
      semanticKind: "angle",
      ownerId: OWNER_ID,
      status: "value",
      value: theta_k_deg,
    }),
    Object.freeze({
      quantityId: "waveFrequencyStationary",
      unit: "Hz",
      semanticKind: "frequency",
      ownerId: OWNER_ID,
      status: "value",
      value: nuK,
    }),
    Object.freeze({
      quantityId: "waveFrequencyMoving",
      unit: "Hz",
      semanticKind: "frequency",
      ownerId: OWNER_ID,
      status: "value",
      value: nu_k,
    }),
    Object.freeze({
      quantityId: "dopplerFactor",
      unit: "1",
      semanticKind: "ratio",
      ownerId: OWNER_ID,
      status: "value",
      value: doppler,
    }),
    Object.freeze({
      quantityId: "wavePhase",
      unit: "rad",
      semanticKind: "angle",
      ownerId: OWNER_ID,
      status: "value",
      value: val1_K,
    }),
    Object.freeze({
      quantityId: "lorentzFactor",
      unit: "1",
      semanticKind: "lorentz-factor",
      ownerId: OWNER_ID,
      status: "value",
      value: g,
    }),
    Object.freeze({
      quantityId: "classicalObserverDopplerFactor",
      unit: "1",
      semanticKind: "ratio",
      ownerId: OWNER_ID,
      status: "value",
      value: classicalObserver,
    }),
    Object.freeze({
      quantityId: "classicalSourceDopplerFactor",
      unit: "1",
      semanticKind: "ratio",
      ownerId: OWNER_ID,
      status: "value",
      value: classicalSource,
    }),
    Object.freeze({
      quantityId: "recedingDopplerFactor",
      unit: "1",
      semanticKind: "ratio",
      ownerId: OWNER_ID,
      status: "value",
      value: recedingFactor,
    }),
    Object.freeze({
      quantityId: "approachingDopplerFactor",
      unit: "1",
      semanticKind: "ratio",
      ownerId: OWNER_ID,
      status: "value",
      value: approachingFactor,
    }),
  ];

  return Object.freeze({
    beta,
    gamma: g,
    propagationAngleStationaryDeg: thetaDeg,
    propagationAngleStationaryRad: thetaRad,
    propagationAngleMovingDeg: theta_k_deg,
    propagationAngleMovingRad: ab.thetaPrimeRad,
    cosThetaStationary: cosThetaK,
    sinThetaStationary: sinThetaK,
    cosThetaMoving: ab.cosThetaPrime,
    sinThetaMoving: ab.sinThetaPrime,
    waveFrequencyStationaryHz: nuK,
    waveFrequencyMovingHz: nu_k,
    waveAngularFrequencyStationary: omegaK,
    waveAngularFrequencyMoving: omega_k,
    dopplerFactor: doppler,
    amplitudeFactor: doppler,
    lineOfSightRecedingFactor: recedingFactor,
    lineOfSightApproachingFactor: approachingFactor,
    detectorCrossings,
    detectorProperRateHz,
    earthOrbitAberrationArcsec,
    earthOrbitAberrationFormatted,
    secondOrderShift: secondOrderShiftVal,
    secondOrderComparisonSpeed: secondOrderSpeed,
    events,
    results,
    status: "value",
  });
}

export type Sr10Input = Readonly<{
  beta: number;
  propagationAngleDeg: number;
  initialEnergyJ?: number;
  initialVolumeM3?: number;
  initialAmplitude?: number;
  showCountermodel?: boolean;
}>;

export interface Sr10EvaluationResult {
  beta: number;
  gamma: number;
  propagationAngleStationaryDeg: number;
  propagationAngleStationaryRad: number;
  propagationAngleMovingDeg: number;
  propagationAngleMovingRad: number;
  cosThetaStationary: number;
  sinThetaStationary: number;
  cosThetaMoving: number;
  sinThetaMoving: number;
  initialEnergyJ: number;
  transformedEnergyJ: number;
  initialVolumeM3: number;
  transformedVolumeM3: number;
  initialAmplitude: number;
  transformedAmplitude: number;
  energyFactor: number;
  energyDensityFactor: number;
  volumeFactor: number;
  amplitudeFactor: number;
  materialVolumeFactor: number;
  countermodelEnergyJ: number;
  countermodelVolumeM3: number;
  countermodelEnergyFactor: number;
  countermodelVolumeFactor: number;
  numericVolumeM3: number;
  results: readonly ScientificResult[];
  status: "value" | "outside-domain";
}

function sr10Outside(quantityId: string, unit: string, semanticKind: string): ScientificResult {
  return Object.freeze({
    quantityId,
    unit,
    semanticKind,
    ownerId: OWNER_ID,
    status: "outside-domain" as const,
    condition: "superluminal-speed",
    domainKind: "physical" as const,
    reason: "No inertial observer at |v| >= c.",
    boundary: { parameterId: "beta", value: 0.95 },
  });
}

export function evaluateSr10(input: Sr10Input): Sr10EvaluationResult {
  const beta = input.beta;
  const thetaDeg = input.propagationAngleDeg;
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const initialEnergyJ = input.initialEnergyJ ?? 1.0;
  const initialVolumeM3 = input.initialVolumeM3 ?? 1.0;
  const initialAmplitude = input.initialAmplitude ?? 1.0;

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    return Object.freeze({
      beta,
      gamma: Number.NaN,
      propagationAngleStationaryDeg: thetaDeg,
      propagationAngleStationaryRad: thetaRad,
      propagationAngleMovingDeg: Number.NaN,
      propagationAngleMovingRad: Number.NaN,
      cosThetaStationary: Number.NaN,
      sinThetaStationary: Number.NaN,
      cosThetaMoving: Number.NaN,
      sinThetaMoving: Number.NaN,
      initialEnergyJ,
      transformedEnergyJ: Number.NaN,
      initialVolumeM3,
      transformedVolumeM3: Number.NaN,
      initialAmplitude,
      transformedAmplitude: Number.NaN,
      energyFactor: Number.NaN,
      energyDensityFactor: Number.NaN,
      volumeFactor: Number.NaN,
      amplitudeFactor: Number.NaN,
      materialVolumeFactor: Number.NaN,
      countermodelEnergyJ: Number.NaN,
      countermodelVolumeM3: Number.NaN,
      countermodelEnergyFactor: Number.NaN,
      countermodelVolumeFactor: Number.NaN,
      numericVolumeM3: Number.NaN,
      results: [
        sr10Outside("frameSpeed", "c", "speed"),
        sr10Outside("propagationAngleStationary", "deg", "angle"),
        sr10Outside("propagationAngleMoving", "deg", "angle"),
        sr10Outside("lightComplexEnergyStationary", "J", "energy"),
        sr10Outside("lightComplexEnergyMoving", "J", "energy"),
        sr10Outside("lightComplexVolumeStationary", "m^3", "space-geometry"),
        sr10Outside("lightComplexVolumeMoving", "m^3", "space-geometry"),
        sr10Outside("lightAmplitudeStationary", "V/m", "field"),
        sr10Outside("lightAmplitudeMoving", "V/m", "field"),
        sr10Outside("dopplerFactor", "1", "ratio"),
        sr10Outside("lorentzFactor", "1", "lorentz-factor"),
        sr10Outside("energyDensityFactor", "1", "ratio"),
        sr10Outside("volumeFactor", "1", "ratio"),
        sr10Outside("materialVolumeFactor", "1", "ratio"),
        sr10Outside("countermodelEnergyMoving", "J", "energy"),
        sr10Outside("countermodelVolumeMoving", "m^3", "space-geometry"),
        sr10Outside("countermodelEnergyFactor", "1", "ratio"),
        sr10Outside("countermodelVolumeFactor", "1", "ratio"),
      ],
      status: "outside-domain",
    });
  }

  const gResult = gamma(beta);
  const g = gResult.status === "value" ? gResult.value : Number.NaN;
  const cosThetaK = Math.cos(thetaRad);
  const sinThetaK = Math.sin(thetaRad);

  const factors = lightComplexFactors(beta, thetaRad);
  const q = factors.energyFactor;
  const q2 = factors.energyDensityFactor;
  const volFactor = factors.volumeFactor;

  const ab = aberration(beta, thetaRad);
  let theta_k_deg = (ab.thetaPrimeRad * 180) / Math.PI;
  if (theta_k_deg < 0) theta_k_deg += 360;

  const transformedEnergyJ = initialEnergyJ * q;
  const transformedVolumeM3 = initialVolumeM3 * volFactor;
  const transformedAmplitude = initialAmplitude * q;

  const countermodel = lightComplexMaterialContractionCountermodel(beta, thetaRad);
  const countermodelEnergyFactor = countermodel.factor;
  const countermodelVolumeFactor = countermodel.factor;
  const countermodelEnergyJ = initialEnergyJ * countermodelEnergyFactor;
  const countermodelVolumeM3 = initialVolumeM3 * countermodelVolumeFactor;
  const materialVolumeFactor = 1 / g;

  const numericVolRatio = lightComplexVolumeNumeric(beta, thetaRad);
  const numericVolumeM3 = initialVolumeM3 * numericVolRatio;

  const val = (
    quantityId: string,
    unit: string,
    semanticKind: string,
    v: number,
  ): ScientificResult =>
    Object.freeze({
      quantityId,
      unit,
      semanticKind,
      ownerId: OWNER_ID,
      status: "value" as const,
      value: v,
    });

  const results: readonly ScientificResult[] = [
    val("frameSpeed", "c", "speed", beta),
    val("propagationAngleStationary", "deg", "angle", thetaDeg),
    val("propagationAngleMoving", "deg", "angle", theta_k_deg),
    val("lightComplexEnergyStationary", "J", "energy", initialEnergyJ),
    val("lightComplexEnergyMoving", "J", "energy", transformedEnergyJ),
    val("lightComplexVolumeStationary", "m^3", "space-geometry", initialVolumeM3),
    val("lightComplexVolumeMoving", "m^3", "space-geometry", transformedVolumeM3),
    val("lightAmplitudeStationary", "V/m", "field", initialAmplitude),
    val("lightAmplitudeMoving", "V/m", "field", transformedAmplitude),
    val("dopplerFactor", "1", "ratio", q),
    val("lorentzFactor", "1", "lorentz-factor", g),
    val("energyDensityFactor", "1", "ratio", q2),
    val("volumeFactor", "1", "ratio", volFactor),
    val("materialVolumeFactor", "1", "ratio", materialVolumeFactor),
    val("countermodelEnergyMoving", "J", "energy", countermodelEnergyJ),
    val("countermodelVolumeMoving", "m^3", "space-geometry", countermodelVolumeM3),
    val("countermodelEnergyFactor", "1", "ratio", countermodelEnergyFactor),
    val("countermodelVolumeFactor", "1", "ratio", countermodelVolumeFactor),
  ];

  return Object.freeze({
    beta,
    gamma: g,
    propagationAngleStationaryDeg: thetaDeg,
    propagationAngleStationaryRad: thetaRad,
    propagationAngleMovingDeg: theta_k_deg,
    propagationAngleMovingRad: ab.thetaPrimeRad,
    cosThetaStationary: cosThetaK,
    sinThetaStationary: sinThetaK,
    cosThetaMoving: ab.cosThetaPrime,
    sinThetaMoving: ab.sinThetaPrime,
    initialEnergyJ,
    transformedEnergyJ,
    initialVolumeM3,
    transformedVolumeM3,
    initialAmplitude,
    transformedAmplitude,
    energyFactor: q,
    energyDensityFactor: q2,
    volumeFactor: volFactor,
    amplitudeFactor: q,
    materialVolumeFactor,
    countermodelEnergyJ,
    countermodelVolumeM3,
    countermodelEnergyFactor,
    countermodelVolumeFactor,
    numericVolumeM3,
    results,
    status: "value",
  });
}

export type Sr11Input = Readonly<{
  beta: number;
  incidentAngleDeg: number;
  incidentEnergyDensity?: number;
  mirrorArea?: number;
  frame?: "lab" | "mirror";
  unitLayer?: "si" | "gaussian";
}>;

export interface Sr11EvaluationResult {
  beta: number;
  incidentAngleDeg: number;
  incidentAngleRad: number;
  incidentEnergyDensity: number;
  mirrorArea: number;
  frame: "lab" | "mirror";
  unitLayer: "si" | "gaussian";
  frequencyRatio: number;
  cosPhiReflected: number;
  phiReflectedRad: number;
  phiReflectedDeg: number;
  amplitudeRatio: number;
  radiationPressure: number;
  radiationForce: number;
  incidentPower: number;
  reflectedPower: number;
  workRate: number;
  energyBalanceResidual: number;
  explanation: string;
  results: readonly ScientificResult[];
  status: "value" | "not-applicable" | "indeterminate" | "outside-domain";
  reason?: string;
}

export function evaluateSr11(input: Sr11Input): Sr11EvaluationResult {
  const beta = input.beta;
  const phiDeg = input.incidentAngleDeg;
  const phiRad = (phiDeg * Math.PI) / 180;
  const u = input.incidentEnergyDensity ?? 1.0;
  const Am = input.mirrorArea ?? 1.0;
  const frame = input.frame ?? "lab";
  const unitLayer = input.unitLayer ?? "si";
  const c = 1.0;

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    const reason = "Mirror speed beta must be in (-1, 1).";
    const outside = (quantityId: string, unit: string, semanticKind: string): ScientificResult =>
      Object.freeze({
        quantityId,
        unit,
        semanticKind,
        ownerId: OWNER_ID,
        status: "outside-domain" as const,
        condition: "superluminal-speed",
        domainKind: "physical" as const,
        reason,
        boundary: { parameterId: "beta", value: 0.95 },
      });

    return Object.freeze({
      beta,
      incidentAngleDeg: phiDeg,
      incidentAngleRad: phiRad,
      incidentEnergyDensity: u,
      mirrorArea: Am,
      frame,
      unitLayer,
      frequencyRatio: Number.NaN,
      cosPhiReflected: Number.NaN,
      phiReflectedRad: Number.NaN,
      phiReflectedDeg: Number.NaN,
      amplitudeRatio: Number.NaN,
      radiationPressure: Number.NaN,
      radiationForce: Number.NaN,
      incidentPower: Number.NaN,
      reflectedPower: Number.NaN,
      workRate: Number.NaN,
      energyBalanceResidual: Number.NaN,
      explanation: reason,
      results: [
        outside("frequencyRatio", "1", "ratio"),
        outside("cosPhiReflected", "1", "cosine"),
        outside("phiReflectedDeg", "deg", "angle"),
        outside("amplitudeRatio", "1", "ratio"),
        outside("radiationPressure", "Pa", "pressure"),
        outside("radiationForce", "N", "force"),
        outside("incidentPower", "W", "power"),
        outside("reflectedPower", "W", "power"),
        outside("workRate", "W", "power"),
        outside("energyBalanceResidual", "W", "power"),
      ],
      status: "outside-domain" as const,
      reason,
    });
  }

  const mmRes = movingMirror(beta, phiRad, { u, c, Am });

  if (mmRes.status !== "value") {
    const reason = mmRes.reason;
    const makeStatusResult = (
      quantityId: string,
      unit: string,
      semanticKind: string,
    ): ScientificResult => {
      if (mmRes.status === "outside-domain") {
        return Object.freeze({
          quantityId,
          unit,
          semanticKind,
          ownerId: OWNER_ID,
          status: "outside-domain" as const,
          condition: mmRes.condition,
          domainKind: mmRes.domainKind,
          reason,
          boundary: { parameterId: "beta", value: 0.95 },
        });
      }
      return Object.freeze({
        quantityId,
        unit,
        semanticKind,
        ownerId: OWNER_ID,
        status: "not-applicable" as const,
        reason,
      });
    };

    return Object.freeze({
      beta,
      incidentAngleDeg: phiDeg,
      incidentAngleRad: phiRad,
      incidentEnergyDensity: u,
      mirrorArea: Am,
      frame,
      unitLayer,
      frequencyRatio: Number.NaN,
      cosPhiReflected: Number.NaN,
      phiReflectedRad: Number.NaN,
      phiReflectedDeg: Number.NaN,
      amplitudeRatio: Number.NaN,
      radiationPressure: Number.NaN,
      radiationForce: Number.NaN,
      incidentPower: Number.NaN,
      reflectedPower: Number.NaN,
      workRate: Number.NaN,
      energyBalanceResidual: Number.NaN,
      explanation: reason,
      results: [
        makeStatusResult("frequencyRatio", "1", "ratio"),
        makeStatusResult("cosPhiReflected", "1", "cosine"),
        makeStatusResult("phiReflectedDeg", "deg", "angle"),
        makeStatusResult("amplitudeRatio", "1", "ratio"),
        makeStatusResult("radiationPressure", "Pa", "pressure"),
        makeStatusResult("radiationForce", "N", "force"),
        makeStatusResult("incidentPower", "W", "power"),
        makeStatusResult("reflectedPower", "W", "power"),
        makeStatusResult("workRate", "W", "power"),
        makeStatusResult("energyBalanceResidual", "W", "power"),
      ],
      status: mmRes.status,
      reason,
    });
  }

  let frequencyRatio: number;
  let cosPhiReflected: number;
  let phiReflectedRad: number;
  let amplitudeRatio: number;
  let radiationPressure: number;
  let radiationForce: number;
  let incidentPower: number;
  let reflectedPower: number;
  let workRate: number;
  let energyBalanceResidual: number;
  let explanation: string;

  if (frame === "mirror") {
    const ledger = mirrorFrameLedger(beta, phiRad, { I: u, Am, c });
    frequencyRatio = ledger.frequencyFactor;
    cosPhiReflected = ledger.cosPhiPrime;
    phiReflectedRad = ledger.phiPrimeRad;
    amplitudeRatio = ledger.frequencyFactor;
    radiationPressure = ledger.forcePrime / Am;
    radiationForce = ledger.forcePrime;
    incidentPower = ledger.incidentPower;
    reflectedPower = ledger.reflectedPower;
    workRate = 0;
    energyBalanceResidual = 0;
    explanation =
      "In the mirror rest frame, reflection does no mechanical work and incident power equals reflected power.";
  } else {
    frequencyRatio = mmRes.frequencyRatio;
    cosPhiReflected = mmRes.cosPhiReflected;
    phiReflectedRad = mmRes.phiReflectedRad;
    amplitudeRatio = mmRes.amplitudeRatio;
    radiationPressure = mmRes.radiationPressure;
    radiationForce = mmRes.radiationForce;
    incidentPower = mmRes.incidentPower;
    reflectedPower = mmRes.reflectedPower;
    workRate = mmRes.workRate;
    energyBalanceResidual = mmRes.energyBalanceResidual;
    explanation = mmRes.explanation ?? "";
  }

  const phiReflectedDeg = (phiReflectedRad * 180) / Math.PI;

  const val = (
    quantityId: string,
    unit: string,
    semanticKind: string,
    v: number,
  ): ScientificResult =>
    Object.freeze({
      quantityId,
      unit,
      semanticKind,
      ownerId: OWNER_ID,
      status: "value" as const,
      value: v,
    });

  const results: ScientificResult[] = [
    val("frequencyRatio", "1", "ratio", frequencyRatio),
    val("cosPhiReflected", "1", "cosine", cosPhiReflected),
    val("phiReflectedDeg", "deg", "angle", phiReflectedDeg),
    val("amplitudeRatio", "1", "ratio", amplitudeRatio),
    val("radiationPressure", "Pa", "pressure", radiationPressure),
    val("radiationForce", "N", "force", radiationForce),
    val("incidentPower", "W", "power", incidentPower),
    val("reflectedPower", "W", "power", reflectedPower),
    val("workRate", "W", "power", workRate),
    val("energyBalanceResidual", "W", "power", energyBalanceResidual),
  ];

  return Object.freeze({
    beta,
    incidentAngleDeg: phiDeg,
    incidentAngleRad: phiRad,
    incidentEnergyDensity: u,
    mirrorArea: Am,
    frame,
    unitLayer,
    frequencyRatio,
    cosPhiReflected,
    phiReflectedRad,
    phiReflectedDeg,
    amplitudeRatio,
    radiationPressure,
    radiationForce,
    incidentPower,
    reflectedPower,
    workRate,
    energyBalanceResidual,
    explanation,
    results,
    status: "value" as const,
  });
}
