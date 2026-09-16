/**
 * Photoelectric reference evaluator (am-lq-08-photoelectric-va5a).
 * Implements Einstein's 1905 light-quantum photoelectric relations (paper 1, §8),
 * stopping potentials, quantum/emission rates, collector current sweep characteristics,
 * cathode luminescence threshold, and historical printed checks.
 *
 * Epistemic boundary:
 * A simulator programmed with a threshold does not prove nature has a threshold;
 * it shows the deductive consequences of quantum transfer and escape work assumptions.
 * Independent experiments (e.g. Millikan 1916) test whether those assumptions
 * accurately describe the physical world.
 */

import type { DomainKind } from "../../experiments/results/types.ts";
import { type ConstantSet, constantValue, getConstantSet } from "./constants.ts";

export type PhotoelectricOk<T> = Readonly<{
  status: "value";
  value: T;
  unit?: string | undefined;
}>;

export type PhotoelectricNotApplicable = Readonly<{
  status: "not-applicable";
  reason: string;
}>;

export type PhotoelectricOutsideDomain = Readonly<{
  status: "outside-domain";
  condition: string;
  domainKind: DomainKind;
  reason: string;
}>;

export type PhotoelectricUnderdetermined = Readonly<{
  status: "underdetermined";
  compatibleFamily: string;
  neededInformation: readonly string[];
}>;

export type PhotoelectricResult<T> =
  | PhotoelectricOk<T>
  | PhotoelectricNotApplicable
  | PhotoelectricOutsideDomain
  | PhotoelectricUnderdetermined;

export function ok<T>(value: T, unit?: string): PhotoelectricOk<T> {
  return Object.freeze({ status: "value", value, unit });
}

export function notApplicable(reason: string): PhotoelectricNotApplicable {
  return Object.freeze({ status: "not-applicable", reason });
}

export function outsideDomain(
  condition: string,
  domainKind: DomainKind,
  reason: string,
): PhotoelectricOutsideDomain {
  return Object.freeze({ status: "outside-domain", condition, domainKind, reason });
}

export function underdetermined(
  compatibleFamily: string,
  neededInformation: readonly string[],
): PhotoelectricUnderdetermined {
  return Object.freeze({
    status: "underdetermined",
    compatibleFamily,
    neededInformation: Object.freeze([...neededInformation]),
  });
}

function getPlanckConstant(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  return constantValue(activeSet, "planckConstant").value;
}

function getElementaryCharge(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  return constantValue(activeSet, "elementaryCharge").value;
}

/**
 * Energy of a single light quantum: E_q = h * nu (in Joules).
 */
export function quantumEnergy(nu: number, set?: ConstantSet): PhotoelectricResult<number> {
  if (!Number.isFinite(nu)) {
    return outsideDomain("nonfinite-frequency", "input", "Frequency must be a finite number.");
  }
  if (nu <= 0) {
    return outsideDomain(
      "nonpositive-frequency",
      "physical",
      "Frequency must be strictly positive.",
    );
  }
  const h = getPlanckConstant(set);
  return ok(h * nu, "J");
}

/**
 * Energy of a single light quantum in electron-volts: E_q = (h / e) * nu.
 */
export function quantumEnergyEv(nu: number, set?: ConstantSet): PhotoelectricResult<number> {
  const res = quantumEnergy(nu, set);
  if (res.status !== "value") return res;
  const e = getElementaryCharge(set);
  return ok(res.value / e, "eV");
}

/**
 * Threshold frequency nu_0 = Phi / h (in Hz), given work function in Joules.
 */
export function thresholdFrequency(
  workFunctionJoules: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(workFunctionJoules)) {
    return outsideDomain(
      "nonfinite-work-function",
      "input",
      "Work function must be a finite number.",
    );
  }
  if (workFunctionJoules <= 0) {
    return outsideDomain(
      "nonpositive-work-function",
      "physical",
      "Work function must be strictly positive.",
    );
  }
  const h = getPlanckConstant(set);
  return ok(workFunctionJoules / h, "Hz");
}

/**
 * Threshold frequency nu_0 = Phi_eV / (h/e) (in Hz), given work function in eV.
 */
export function thresholdFrequencyFromEv(
  workFunctionEv: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  const e = getElementaryCharge(set);
  return thresholdFrequency(workFunctionEv * e, set);
}

/**
 * Maximum kinetic energy of emitted photoelectrons: K_max = h * nu - Phi (in Joules).
 *
 * Epistemic rule:
 * When nu < nu_0, K_max is NOT negative or zero; it is `not-applicable`
 * with reason "no emitted electron in this model".
 */
export function kMax(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(nu)) {
    return outsideDomain("nonfinite-frequency", "input", "Frequency must be a finite number.");
  }
  if (nu <= 0) {
    return outsideDomain(
      "nonpositive-frequency",
      "physical",
      "Frequency must be strictly positive.",
    );
  }
  if (!Number.isFinite(workFunctionJoules)) {
    return outsideDomain(
      "nonfinite-work-function",
      "input",
      "Work function must be a finite number.",
    );
  }
  if (workFunctionJoules <= 0) {
    return outsideDomain(
      "nonpositive-work-function",
      "physical",
      "Work function must be strictly positive.",
    );
  }

  const h = getPlanckConstant(set);
  const eq = h * nu;

  if (eq < workFunctionJoules) {
    return notApplicable("no emitted electron in this model");
  }

  return ok(eq - workFunctionJoules, "J");
}

/**
 * Maximum kinetic energy in electron-volts: K_max / e = (h/e)*nu - Phi_eV.
 */
export function kMaxEv(
  nu: number,
  workFunctionEv: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  const e = getElementaryCharge(set);
  const res = kMax(nu, workFunctionEv * e, set);
  if (res.status !== "value") return res;
  return ok(res.value / e, "eV");
}

/**
 * Stopping potential magnitude: V_s = K_max / e = (h * nu - Phi) / e (in Volts).
 *
 * Epistemic rule:
 * When nu < nu_0, stopping potential is `not-applicable` with reason
 * "no emitted electron in this model".
 */
export function stoppingPotentialMagnitude(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  const kResult = kMax(nu, workFunctionJoules, set);
  if (kResult.status !== "value") return kResult;
  const e = getElementaryCharge(set);
  return ok(kResult.value / e, "V");
}

/**
 * Stopping potential magnitude given work function in eV.
 */
export function stoppingPotentialFromEv(
  nu: number,
  workFunctionEv: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  const e = getElementaryCharge(set);
  return stoppingPotentialMagnitude(nu, workFunctionEv * e, set);
}

/**
 * Full signed energy budget report for display and diagnostics.
 */
export function signedEnergyBudget(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
): Readonly<{
  quantumEnergy: number;
  workFunction: number;
  excessJoules: number;
  excessEv: number;
  emitted: boolean;
  kMax: PhotoelectricResult<number>;
}> {
  const h = getPlanckConstant(set);
  const e = getElementaryCharge(set);
  const eq = h * nu;
  const excess = eq - workFunctionJoules;
  const emitted = excess >= 0 && nu > 0 && workFunctionJoules > 0;
  return Object.freeze({
    quantumEnergy: eq,
    workFunction: workFunctionJoules,
    excessJoules: excess,
    excessEv: excess / e,
    emitted,
    kMax: kMax(nu, workFunctionJoules, set),
  });
}

/**
 * Incident quantum rate: N_dot_q = P_opt / (h * nu) (in photons/s).
 *
 * Energy vs. rate distinction:
 * Power P_opt changes N_dot_q and N_dot_e linearly, but leaves K_max and V_s bitwise unchanged.
 * Frequency nu changes K_max linearly and changes N_dot_q as 1/nu at fixed power.
 */
export function quantumRate(
  incidentPowerWatts: number,
  nu: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(incidentPowerWatts)) {
    return outsideDomain("nonfinite-power", "input", "Power must be a finite number.");
  }
  if (incidentPowerWatts < 0) {
    return outsideDomain(
      "negative-power",
      "physical",
      "Incident optical power cannot be negative.",
    );
  }
  if (!Number.isFinite(nu)) {
    return outsideDomain("nonfinite-frequency", "input", "Frequency must be a finite number.");
  }
  if (nu <= 0) {
    return outsideDomain(
      "nonpositive-frequency",
      "physical",
      "Frequency must be strictly positive.",
    );
  }

  const h = getPlanckConstant(set);
  const rate = incidentPowerWatts / (h * nu);
  return ok(rate, "s^-1");
}

/**
 * Photoelectron emission rate: N_dot_e = eta_q * N_dot_q (in electrons/s).
 *
 * When nu < nu_0, emission rate is 0.
 */
export function emissionRate(
  incidentPowerWatts: number,
  nu: number,
  workFunctionJoules: number,
  quantumEfficiency: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(quantumEfficiency)) {
    return outsideDomain(
      "nonfinite-quantum-efficiency",
      "input",
      "Quantum efficiency must be a finite number.",
    );
  }
  if (quantumEfficiency < 0 || quantumEfficiency > 1) {
    return outsideDomain(
      "invalid-quantum-efficiency",
      "model",
      "Quantum efficiency must be in the range [0, 1].",
    );
  }

  const qRateRes = quantumRate(incidentPowerWatts, nu, set);
  if (qRateRes.status !== "value") return qRateRes;

  const h = getPlanckConstant(set);
  if (h * nu < workFunctionJoules) {
    return ok(0, "s^-1");
  }

  return ok(quantumEfficiency * qRateRes.value, "s^-1");
}

/**
 * Collector photocurrent I(U_c) in Amperes.
 *
 * Determined regimes:
 * - When nu < nu_0: I = 0 for all U_c.
 * - When nu >= nu_0:
 *   - For U_c >= 0 (accelerating / neutral): saturation current I_sat = e * N_dot_e.
 *   - For U_c <= -V_s (full retarding): I = 0.
 *   - For -V_s < U_c < 0: underdetermined without an explicit electron energy distribution model.
 */
export function photocurrent(
  incidentPowerWatts: number,
  nu: number,
  workFunctionJoules: number,
  quantumEfficiency: number,
  collectorPotentialVolts: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(collectorPotentialVolts)) {
    return outsideDomain(
      "nonfinite-collector-potential",
      "input",
      "Collector potential must be finite.",
    );
  }

  const eRateRes = emissionRate(incidentPowerWatts, nu, workFunctionJoules, quantumEfficiency, set);
  if (eRateRes.status !== "value") return eRateRes;

  const e = getElementaryCharge(set);
  const iSat = e * eRateRes.value;

  if (eRateRes.value === 0) {
    return ok(0, "A");
  }

  const vsRes = stoppingPotentialMagnitude(nu, workFunctionJoules, set);
  if (vsRes.status !== "value") {
    return ok(0, "A");
  }
  const vs = vsRes.value;

  if (collectorPotentialVolts >= 0) {
    return ok(iSat, "A");
  }

  if (collectorPotentialVolts <= -vs) {
    return ok(0, "A");
  }

  return underdetermined("retarded-photoelectron-current", [
    "electron-energy-distribution-in-emitter",
    "collector-geometry",
  ]);
}

/**
 * Sweep of collector potential evaluating photocurrent across a voltage range.
 */
export function collectorSweep(
  incidentPowerWatts: number,
  nu: number,
  workFunctionJoules: number,
  quantumEfficiency: number,
  potentialRange: Readonly<{ min: number; max: number; steps: number }>,
  set?: ConstantSet,
): readonly Readonly<{
  collectorPotential: number;
  result: PhotoelectricResult<number>;
}>[] {
  const { min, max, steps } = potentialRange;
  const clampedSteps = Math.max(2, Math.floor(steps));
  const points: { collectorPotential: number; result: PhotoelectricResult<number> }[] = [];
  const delta = (max - min) / (clampedSteps - 1);

  for (let i = 0; i < clampedSteps; i++) {
    const uc = min + i * delta;
    const res = photocurrent(
      incidentPowerWatts,
      nu,
      workFunctionJoules,
      quantumEfficiency,
      uc,
      set,
    );
    points.push(Object.freeze({ collectorPotential: uc, result: res }));
  }

  return Object.freeze(points);
}

/**
 * Theoretical stopping potential line V_s(nu) = (h/e)*nu - (Phi/e).
 * Only evaluated for nu >= nu_0.
 */
export function stoppingLine(
  workFunctionJoules: number,
  nuRange: Readonly<{ min: number; max: number; steps: number }>,
  set?: ConstantSet,
): readonly Readonly<{
  frequency: number;
  stoppingPotential: number;
}>[] {
  const threshRes = thresholdFrequency(workFunctionJoules, set);
  if (threshRes.status !== "value") return Object.freeze([]);
  const nu0 = threshRes.value;

  const { min, max, steps } = nuRange;
  const clampedSteps = Math.max(2, Math.floor(steps));
  const effectiveMin = Math.max(min, nu0);
  if (effectiveMin > max) return Object.freeze([]);

  const points: { frequency: number; stoppingPotential: number }[] = [];
  const delta = (max - effectiveMin) / (clampedSteps - 1);

  for (let i = 0; i < clampedSteps; i++) {
    const freq = effectiveMin + i * delta;
    const vsRes = stoppingPotentialMagnitude(freq, workFunctionJoules, set);
    if (vsRes.status === "value") {
      points.push(Object.freeze({ frequency: freq, stoppingPotential: vsRes.value }));
    }
  }

  return Object.freeze(points);
}

/**
 * Cathode luminescence minimum potential (paper 1, §7):
 * Accelerating potential required for an impinging electron to excite emission of frequency nu.
 * U_min = (h * nu - Phi) / e or h * nu / e.
 */
export function cathodeLuminescenceMinimumPotential(
  nu: number,
  workFunctionJoules: number,
  set?: ConstantSet,
): PhotoelectricResult<number> {
  if (!Number.isFinite(nu) || nu <= 0) {
    return outsideDomain("invalid-frequency", "physical", "Frequency must be strictly positive.");
  }
  const h = getPlanckConstant(set);
  const e = getElementaryCharge(set);
  const uMin = (h * nu - workFunctionJoules) / e;
  return ok(Math.max(0, uMin), "V");
}

/**
 * Converts optical frequency to human-readable spectral band label and approximate hex color.
 */
export function visibleColor(nu: number): Readonly<{
  band: string;
  wavelengthNm: number;
  hexColor: string;
}> {
  const c = 2.99792458e8;
  const lambdaM = c / nu;
  const lambdaNm = lambdaM * 1e9;

  let band = "visible";
  let hexColor = "#888888";

  if (lambdaNm < 380) {
    band = "ultraviolet";
    hexColor = "#7B1FA2";
  } else if (lambdaNm < 450) {
    band = "violet";
    hexColor = "#5C6BC0";
  } else if (lambdaNm < 495) {
    band = "blue";
    hexColor = "#1E88E5";
  } else if (lambdaNm < 570) {
    band = "green";
    hexColor = "#43A047";
  } else if (lambdaNm < 590) {
    band = "yellow";
    hexColor = "#FDD835";
  } else if (lambdaNm < 620) {
    band = "orange";
    hexColor = "#FB8C00";
  } else if (lambdaNm <= 750) {
    band = "red";
    hexColor = "#E53935";
  } else {
    band = "infrared";
    hexColor = "#8D6E63";
  }

  return Object.freeze({ band, wavelengthNm: lambdaNm, hexColor });
}

/**
 * Historical regression check: Einstein 1905 paper 1, §8.
 *
 * Representation A:
 * Printed gram-equivalent form:
 *   R = 8.31e7 erg/(mol K)
 *   beta = 4.866e-11 K s
 *   E = 9.6e3 emu (gram-equivalent charge)
 *   nu = 1.03e15 s^-1 (ultraviolet light from spark source)
 *   P_prime = 0 (escape work per gram-equivalent neglected for order-of-magnitude check)
 *
 * Calculated stopping potential:
 *   Pi = (R * beta * nu) / E = (8.31e7 * 4.866e-11 * 1.03e15) / 9.6e3
 *      = 4.33852025e8 abV = 4.3385 V.
 *   Einstein printed: "ca. 4.3 Volt".
 *
 * Representation B:
 * Documented modern alternative in ESU:
 *   Pi = 4.3057 V.
 */
export function einsteinPrintedStoppingCheck(): Readonly<{
  representationA: Readonly<{
    molarGasConstantErg: number;
    wienBetaSecDeg: number;
    gramEquivalentChargeEmu: number;
    frequencyHz: number;
    workFunctionPerGramEquivalent: number;
    stoppingPotentialAbV: number;
    stoppingPotentialVolts: number;
    slopeVsPerHz: number;
    printedText: string;
  }>;
  representationB: Readonly<{
    stoppingPotentialVolts: number;
    description: string;
  }>;
  historicalNote: string;
}> {
  const R = 8.31e7; // erg / (mol K)
  const beta = 4.866e-11; // K s
  const E_emu = 9.6e3; // emu / mol
  const nu = 1.03e15; // s^-1
  const P_prime = 0;

  // Pi in abvolts (1 abV = 10^-8 V)
  const piAbV = (R * beta * nu - P_prime) / E_emu;
  const piV = piAbV * 1e-8;
  const slope = ((R * beta) / E_emu) * 1e-8;

  return Object.freeze({
    representationA: Object.freeze({
      molarGasConstantErg: R,
      wienBetaSecDeg: beta,
      gramEquivalentChargeEmu: E_emu,
      frequencyHz: nu,
      workFunctionPerGramEquivalent: P_prime,
      stoppingPotentialAbV: piAbV,
      stoppingPotentialVolts: piV,
      slopeVsPerHz: slope,
      printedText: "ca. 4,3 Volt",
    }),
    representationB: Object.freeze({
      stoppingPotentialVolts: 4.3057,
      description: "Documented alternative electrostatic CGS representation.",
    }),
    historicalNote:
      "Einstein sets P' = 0 as a deliberate neglect of escape work for order-of-magnitude " +
      "comparison against Lenard's spark-potential observations, not as a physical prediction for a named metal.",
  });
}
