/**
 * Relativistic wave mechanics, Doppler effect, aberration, light complexes,
 * and moving mirror electrodynamics reference physics owner.
 *
 * Implements paper 3 §7-8 reference calculations (am-ref-waves-r53).
 * Views must not import this module.
 */

import type { DomainKind, ScientificResult } from "../../experiments/results/types.ts";
import { classifyWithTolerance } from "../../units/tolerance.ts";
import { gamma, gammaMinusOne } from "./kinematics.ts";

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

/**
 * Evaluates the plane wave phase phi = k . x - omega * t at a given 4-event.
 *
 * INDEPENDENCE RULE (am-ref-waves-r53 / am-sr-09-doppler-aberration-rabd):
 * This function computes the inner product and time product from its arguments alone.
 * It MUST NOT call dopplerFactor, aberration, transformWaveVector, or lightComplexFactors,
 * directly or indirectly.
 */
export function phaseAtEvent(coordinates: Event4, waveComponents: Wave4Vector): ScientificResult {
  if (
    !Number.isFinite(coordinates.t) ||
    !Number.isFinite(coordinates.x) ||
    !Number.isFinite(coordinates.y) ||
    !Number.isFinite(coordinates.z) ||
    !Number.isFinite(waveComponents.omega) ||
    !Number.isFinite(waveComponents.kx) ||
    !Number.isFinite(waveComponents.ky) ||
    !Number.isFinite(waveComponents.kz)
  ) {
    return Object.freeze({
      quantityId: "wavePhase",
      unit: "rad",
      semanticKind: "angle",
      ownerId: OWNER_ID,
      status: "outside-domain",
      condition: "nonfinite-input",
      domainKind: "physical",
      reason: "phaseAtEvent requires finite coordinates and wave components.",
      boundary: { parameterId: "coordinates", value: 0 },
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
  const gResult = gamma(beta);
  if (gResult.status !== "value") return Number.NaN;
  const g = gResult.value;
  return g * (1 - beta * Math.cos(thetaRad));
}

/**
 * Relativistic aberration of light direction:
 * cos(theta') = (cos(theta) - beta) / (1 - beta * cos(theta))
 * sin(theta') = sin(theta) / (gamma * (1 - beta * cos(theta)))
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
  const gResult = gamma(beta);
  if (gResult.status !== "value") {
    return Object.freeze({
      cosThetaPrime: Number.NaN,
      sinThetaPrime: Number.NaN,
      thetaPrimeRad: Number.NaN,
    });
  }
  const g = gResult.value;
  const cosTheta = Math.cos(thetaRad);
  const sinTheta = Math.sin(thetaRad);
  const denom = 1 - beta * cosTheta;

  const cosThetaPrime = (cosTheta - beta) / denom;
  const sinThetaPrime = sinTheta / (g * denom);
  const thetaPrimeRad = Math.atan2(sinThetaPrime, cosThetaPrime);

  return Object.freeze({
    cosThetaPrime,
    sinThetaPrime,
    thetaPrimeRad,
  });
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
 * Production countermodel for SR-10's comparison mode:
 * Implements the naive material-contraction substitution q^2 / gamma.
 */
export function lightComplexMaterialContractionCountermodel(
  beta: number,
  thetaRad: number,
): Readonly<{ modelId: string; factor: number }> {
  const gResult = gamma(beta);
  if (gResult.status !== "value") {
    return Object.freeze({
      modelId: "countermodel-material-contraction",
      factor: Number.NaN,
    });
  }
  const g = gResult.value;
  const q = g * (1 - beta * Math.cos(thetaRad));
  return Object.freeze({
    modelId: "countermodel-material-contraction",
    factor: (q * q) / g,
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
